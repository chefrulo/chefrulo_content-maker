import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { loadBrandBrainFoundation, loadBrandBrainReelExamples } from "../lib/brand-brain.js";
import { loadAllIdeas } from "../lib/idea-library.js";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";

const BRIEFS_PER_RUN = 5;

async function loadUsedIdeaIds(): Promise<Set<string>> {
  const dir = path.resolve(process.cwd(), "data", "content-briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return new Set();
  }

  const used = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readDataSafe<ContentBrief | null>(`content-briefs/${file}`, null);
    if (brief) used.add(brief.ideaId);
  }
  return used;
}

function buildPrompt(
  brand: Awaited<ReturnType<typeof getBrand>>,
  ideaText: string,
  brandPillar: string,
  brandBrain: string | null,
  reelExamples: string | null
): string {
  const brandBrainBlock = brandBrain
    ? `## Editorial foundation — non-negotiable, overrides everything below if they ever conflict
${brandBrain}

---
`
    : "";

  const reelExamplesBlock = reelExamples
    ? `## Gold-standard reel examples — reference for tone and cultural insight, not for topic
${reelExamples}

---
`
    : "";

  return `You are the editorial lead for "${brand.name}". You develop ONE approved idea into a Content Brief — an abstract editorial piece, not a shot-by-shot script yet.

${brandBrainBlock}${reelExamplesBlock}## Brand
- Positioning: ${brand.positioning}
- Tone: ${brand.toneKeywords.join(", ")}
- Target audience: ${brand.targetAudience}

## The idea to develop
"${ideaText}"

## Brand pillar for this piece
${brandPillar}

## Task
Develop this idea into a Content Brief. Do NOT write beats, shots, or a script — this is the abstract editorial layer that comes before that. Ground every claim in the brand brain above; never invent a personal story — omit personalStory entirely if none is documented.

Respond with ONLY a raw JSON object (no markdown fences, no prose), with this shape:
{
  "editorialTerritory": "<concrete subject-matter territory this idea belongs to>",
  "hook": "<the core attention-grabbing framing, under 12 words>",
  "coreMessage": "<the one thing this piece needs to communicate, 1-2 sentences>",
  "culturalInsight": "<the specific cultural insight or nuance this piece reveals, 1-2 sentences>",
  "personalStory": "<omit this field entirely unless grounded in a real, documented story from the brand brain>",
  "educationalValue": "<what the audience walks away understanding, 1 sentence>",
  "cta": "<a natural closing question or invitation>"
}`;
}

async function main() {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error(
      "BRAND_BRAIN_PATH no está seteado en .env.local — es obligatorio para generar briefs. Sin el Brand Brain no hay de dónde sacar la voz editorial."
    );
  }

  const brand = await getBrand();
  const allIdeas = await loadAllIdeas();
  if (allIdeas.length === 0) {
    console.log(
      "No hay ideas en knowledge/15-idea-library/ del Brand Brain. Corré `npm run generate:ideas -- <slug-articulo>` primero."
    );
    return;
  }

  const usedIdeaIds = await loadUsedIdeaIds();
  const unusedIdeas = allIdeas.filter((idea) => !usedIdeaIds.has(idea.ideaId));
  if (unusedIdeas.length === 0) {
    console.log("Todas las ideas de la librería ya tienen un Content Brief. Agregá más ideas con `npm run generate:ideas`.");
    return;
  }

  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();
  const pillarNames = brand.pillars.map((p) => p.name);
  const selected = unusedIdeas.slice(0, BRIEFS_PER_RUN);

  console.log(`Generando ${selected.length} briefs desde la Idea Library (${unusedIdeas.length} ideas sin usar disponibles)...`);

  for (let i = 0; i < selected.length; i++) {
    const idea = selected[i]!;
    const brandPillar = pillarNames[i % pillarNames.length]!;
    const prompt = buildPrompt(brand, idea.ideaText, brandPillar, brandBrain, reelExamples);
    const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-content-brief-generator" });

    let text = result.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) text = fenced[1].trim();
    const parsed = JSON.parse(text);

    const brief: ContentBrief = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending_review",
      ideaId: idea.ideaId,
      ideaText: idea.ideaText,
      brandPillar,
      ...parsed,
    };
    await writeData(`content-briefs/${brief.id}.json`, brief);
    console.log(`  [${brief.brandPillar}] "${brief.hook}" -> data/content-briefs/${brief.id}.json`);
  }

  console.log(`\n${selected.length} briefs guardados en data/content-briefs/, status: pending_review.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
