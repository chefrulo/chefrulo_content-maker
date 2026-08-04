import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash, randomUUID } from "node:crypto";
import { brandBrainGateway } from "../lib/brand-brain.js";
import { loadAllIdeas } from "../lib/idea-library.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import { ideaProposalRepository } from "../repositories/operational-repository.js";
import type { IdeaProposalBatch, ProposedIdea } from "../types/idea-proposal.js";

interface GeneratedIdea {
  title: string;
  question: string;
  coreInsight: string;
  whyItMatters: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseGeneratedIdeas(value: unknown): GeneratedIdea[] {
  if (!Array.isArray(value)) {
    throw new Error("Ideas response is not a JSON array");
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`Idea ${index + 1} is not an object`);
    }
    const candidate = item as Record<string, unknown>;
    for (const field of ["title", "question", "coreInsight", "whyItMatters"] as const) {
      if (!isNonEmptyString(candidate[field])) {
        throw new Error(`Idea ${index + 1} has an invalid ${field}`);
      }
    }
    return {
      title: candidate.title as string,
      question: candidate.question as string,
      coreInsight: candidate.coreInsight as string,
      whyItMatters: candidate.whyItMatters as string,
    };
  });
}

function articleIdFromMarkdown(slug: string, article: string): string {
  return article.match(/^id:\s*(\S+)\s*$/m)?.[1] ?? `article-${slug}`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function loadProposalQuestions(articleSlug: string): Promise<Set<string>> {
  const questions = new Set<string>();
  for (const proposal of await ideaProposalRepository.list()) {
    if (proposal.sourceArticleSlug !== articleSlug) continue;
    for (const idea of proposal.ideas) questions.add(idea.question);
  }
  return questions;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("Uso: npm run generate:ideas -- <slug-articulo>");
    return;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Slug inválido: ${slug}`);
  }

  const { revision, foundation, canonicalArticle } =
    await brandBrainGateway.loadGenerationContext(slug);
  const sourceArticleId = articleIdFromMarkdown(slug, canonicalArticle);
  const approvedAndReviewIdeas = await loadAllIdeas();
  const existingQuestions = new Set(
    approvedAndReviewIdeas
      .filter((idea) => idea.articleSlug === slug)
      .map((idea) => idea.ideaText)
  );
  for (const question of await loadProposalQuestions(slug)) existingQuestions.add(question);

  const prompt = `## Brand Brain foundation
${foundation}

---

## Canonical article
${canonicalArticle}

## Task
Generate 8 to 12 concrete, channel-neutral editorial ideas grounded ONLY in this article. Each idea must have one focused question, the single insight that answers it and a concise explanation of why the audience would care. Do not invent facts or personal memories.

Do not write hooks, CTAs, formats, scripts or shot directions. Respond with ONLY a raw JSON array, no markdown fences or prose, using this shape:
[
  {
    "title": "A short descriptive title",
    "question": "One focused editorial question",
    "coreInsight": "The one source-grounded idea the audience should understand",
    "whyItMatters": "Why this matters beyond being an isolated fact"
  }
]`;

  console.log(`Generando propuestas de ideas para "${slug}"...`);
  const { result } = await runClaudeAgent({
    prompt,
    maxBudgetUsd: 0.3,
    name: "chefrulo-idea-proposal-generator",
  });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Failed to parse ideas JSON response: ${error instanceof Error ? error.message : error}\nRaw response: ${text}`
    );
  }

  const generatedIdeas = parseGeneratedIdeas(parsed).filter(
    (idea) => !existingQuestions.has(idea.question)
  );
  if (generatedIdeas.length === 0) {
    console.log("Todas las ideas generadas ya existen o están propuestas. Nada nuevo para guardar.");
    return;
  }

  const ideas: ProposedIdea[] = generatedIdeas.map((idea) => ({
    id: `idea-${slug}-${randomUUID().replaceAll("-", "").slice(0, 8)}`,
    ...idea,
    status: "pending_review",
  }));
  const proposal: IdeaProposalBatch = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    sourceArticleId,
    sourceArticleSlug: slug,
    sourceArticleHash: hashContent(canonicalArticle),
    brandBrainRevision: revision,
    status: "pending_review",
    ideas,
  };

  await ideaProposalRepository.save(proposal);
  console.log(`\n${ideas.length} propuestas guardadas en SQLite, batch ${proposal.id}`);
  for (const idea of ideas) console.log(`  [${idea.id}] ${idea.question}`);
  console.log(`\nEl Brand Brain no fue modificado.`);
  console.log(`Para promover propuestas revisadas: npm run ideas:promote -- ${proposal.id} [ideaId ...]`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
