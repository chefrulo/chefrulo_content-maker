import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { brandBrainGateway } from "../lib/brand-brain.js";
import { parseIdeasFromMarkdown } from "../lib/idea-library.js";
import { ideaProposalRepository } from "../repositories/operational-repository.js";
import type { ProposedIdea } from "../types/idea-proposal.js";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function formatIdea(idea: ProposedIdea, sourceArticleId: string): string {
  return `## ${idea.id} — ${idea.title}\n\n**Status:** review\n**Signature idea:** no\n**Question:** ${idea.question}\n**Core insight:** ${idea.coreInsight}\n**Why it matters:** ${idea.whyItMatters}\n**Source article:** ${sourceArticleId}\n`;
}

async function main() {
  const proposalId = process.argv[2];
  const requestedIdeaIds = new Set(process.argv.slice(3));
  if (!proposalId) {
    console.log("Uso: npm run ideas:promote -- <proposalId> [ideaId ...]");
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(proposalId)) {
    throw new Error(`Proposal ID inválido: ${proposalId}`);
  }

  const proposal = await ideaProposalRepository.get(proposalId);
  const candidates = proposal.ideas.filter(
    (idea) =>
      idea.status === "pending_review" &&
      (requestedIdeaIds.size === 0 || requestedIdeaIds.has(idea.id))
  );
  if (candidates.length === 0) {
    throw new Error("No hay propuestas pendientes que coincidan con los IDs solicitados.");
  }
  if (requestedIdeaIds.size > 0 && candidates.length !== requestedIdeaIds.size) {
    throw new Error("Uno o más idea IDs no existen o ya no están pendientes.");
  }

  await brandBrainGateway.getRevision();
  const currentArticle = await brandBrainGateway.loadArticle(proposal.sourceArticleSlug);
  if (hashContent(currentArticle) !== proposal.sourceArticleHash) {
    throw new Error(
      "El artículo canónico cambió desde que se generó la propuesta. Revisá o regenerá las ideas antes de promoverlas."
    );
  }

  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) throw new Error("BRAND_BRAIN_PATH es obligatorio");
  const libraryDir = path.join(brainPath, IDEA_LIBRARY_SUBDIR);
  const libraryPath = path.join(libraryDir, `${proposal.sourceArticleSlug}.md`);
  await mkdir(libraryDir, { recursive: true });

  let existing = "";
  try {
    existing = await readFile(libraryPath, "utf-8");
  } catch {
    // The first promoted idea creates the article's library file.
  }
  const existingIdeas = existing ? parseIdeasFromMarkdown(proposal.sourceArticleSlug, existing) : [];
  const existingIds = new Set(existingIdeas.map((idea) => idea.ideaId));
  const existingQuestions = new Set(existingIdeas.map((idea) => idea.ideaText));
  for (const idea of candidates) {
    if (existingIds.has(idea.id)) throw new Error(`La idea ${idea.id} ya existe en Brand Brain.`);
    if (existingQuestions.has(idea.question)) {
      throw new Error(`Ya existe una idea con la pregunta: ${idea.question}`);
    }
  }

  const header = `---\narticle_id: ${proposal.sourceArticleId}\narticle_slug: ${proposal.sourceArticleSlug}\narticle_path: ../20-articles/${proposal.sourceArticleSlug}.md\n---\n\n# ${proposal.sourceArticleSlug} Idea Library\n\nIdeas in this file are channel-neutral editorial assets. Only entries with \`Status: approved\` may be used to generate briefs.\n\n`;
  const appendix = candidates.map((idea) => formatIdea(idea, proposal.sourceArticleId)).join("\n");
  const output = existing.trim()
    ? `${existing.replace(/\n*$/, "\n")}${appendix}`
    : `${header}${appendix}`;
  const temporaryPath = `${libraryPath}.tmp`;
  await writeFile(temporaryPath, output, "utf-8");
  await rename(temporaryPath, libraryPath);

  const now = new Date().toISOString();
  const promotedIds = new Set(candidates.map((idea) => idea.id));
  proposal.ideas = proposal.ideas.map((idea) =>
    promotedIds.has(idea.id) ? { ...idea, status: "promoted", promotedAt: now } : idea
  );
  const pending = proposal.ideas.filter((idea) => idea.status === "pending_review").length;
  proposal.status = pending === 0 ? "promoted" : "partially_promoted";
  await ideaProposalRepository.save(proposal);

  console.log(`${candidates.length} ideas promovidas a ${libraryPath} con status review.`);
  console.log("Revisá el diff del Brand Brain, aprobá las que correspondan y hacé commit antes de generar briefs.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
