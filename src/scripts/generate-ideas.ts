import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runClaudeAgent } from "../lib/claude-agent.js";
import { loadBrandBrainFoundation } from "../lib/brand-brain.js";
import { parseIdeasFromMarkdown } from "../lib/idea-library.js";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";
const ARTICLES_SUBDIR = "knowledge/20-articles";

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

function nextIdeaNumber(existingIds: string[]): number {
  const numbers = existingIds
    .map((id) => Number(id.match(/-(\d+)$/)?.[1]))
    .filter((value) => Number.isInteger(value));
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("Uso: npm run generate:ideas -- <slug-articulo>");
    console.log("El slug corresponde a un archivo en knowledge/20-articles/<slug>.md del Brand Brain.");
    return;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Slug inválido: ${slug}`);
  }

  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error("BRAND_BRAIN_PATH no está seteado en .env.local — es obligatorio para generar ideas.");
  }

  const articlePath = path.join(brainPath, ARTICLES_SUBDIR, `${slug}.md`);
  let article: string;
  try {
    article = await readFile(articlePath, "utf-8");
  } catch {
    throw new Error(`No se encontró ${articlePath}. Creá el artículo canónico primero.`);
  }

  const foundation = await loadBrandBrainFoundation();
  const libraryDir = path.join(brainPath, IDEA_LIBRARY_SUBDIR);
  await mkdir(libraryDir, { recursive: true });
  const libraryPath = path.join(libraryDir, `${slug}.md`);
  let existing = "";
  try {
    existing = await readFile(libraryPath, "utf-8");
  } catch {
    // file doesn't exist yet, that's fine
  }
  const parsedExisting = existing.trim() ? parseIdeasFromMarkdown(slug, existing) : [];
  const existingQuestions = new Set(parsedExisting.map((idea) => idea.ideaText));
  const sourceArticleId = articleIdFromMarkdown(slug, article);

  const prompt = `${foundation ? `## Brand Brain\n${foundation}\n\n---\n\n` : ""}## Canonical article
${article}

## Task
Generate 8 to 12 concrete, channel-neutral editorial ideas grounded ONLY in this article. Each idea must have one focused question, the single insight that answers it and a concise explanation of why the audience would care. Do not invent facts or personal memories. Match the specificity of these examples:

- Why does an asado last five hours if the meat cooks much faster?
- Why is choripán served before the meat?
- What does the asador actually do?

Do not write hooks, CTAs, formats, scripts or shot directions. Respond with ONLY a raw JSON array, no markdown fences or prose, using this shape:
[
  {
    "title": "A short descriptive title",
    "question": "One focused editorial question",
    "coreInsight": "The one source-grounded idea the audience should understand",
    "whyItMatters": "Why this matters beyond being an isolated fact"
  }
]`;

  console.log(`Generando ideas para "${slug}"...`);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-idea-generator" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Failed to parse ideas JSON response: ${err instanceof Error ? err.message : err}\nRaw response: ${text}`
    );
  }
  const ideas = parseGeneratedIdeas(parsed);

  const newIdeas = ideas.filter((idea) => !existingQuestions.has(idea.question));
  if (newIdeas.length === 0) {
    console.log("Todas las ideas generadas ya estaban en la librería. Nada nuevo para agregar.");
    return;
  }

  let nextNumber = nextIdeaNumber(parsedExisting.map((idea) => idea.ideaId));
  const appendix =
    newIdeas
      .map((idea) => {
        const ideaId = `idea-${slug}-${String(nextNumber++).padStart(3, "0")}`;
        return `## ${ideaId} — ${idea.title}\n\n**Status:** review\n**Signature idea:** no\n**Question:** ${idea.question}\n**Core insight:** ${idea.coreInsight}\n**Why it matters:** ${idea.whyItMatters}\n**Source article:** ${sourceArticleId}\n`;
      })
      .join("\n") + "\n";
  const output =
    existing.trim().length > 0
      ? existing.replace(/\n*$/, "\n") + appendix
      : `---\narticle_id: ${sourceArticleId}\narticle_slug: ${slug}\narticle_path: ../20-articles/${slug}.md\n---\n\n# ${slug} Idea Library\n\nIdeas in this file are channel-neutral editorial assets. Only entries with \`Status: approved\` may be used to generate briefs.\n\n${appendix}`;
  await writeFile(libraryPath, output, "utf-8");

  console.log(`\n${newIdeas.length} ideas nuevas agregadas a ${path.relative(brainPath, libraryPath)}:\n`);
  for (const idea of newIdeas) console.log(`  - ${idea.question}`);
  console.log(`\nLas ideas quedaron en status review. Revisalas y cambiá a approved sólo las que quieras usar.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
