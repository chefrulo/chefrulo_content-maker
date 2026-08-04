import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import {
  loadBrandBrainArticle,
  loadBrandBrainFoundation,
  loadBrandBrainReelExamples,
} from "../lib/brand-brain.js";
import { loadAllIdeas, loadApprovedIdeas, type LibraryIdea } from "../lib/idea-library.js";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";

const BRIEFS_PER_RUN = 5;

type ContentBriefFields = Pick<
  ContentBrief,
  "editorialTerritory" | "hook" | "coreMessage" | "culturalInsight" | "personalStory" | "educationalValue" | "cta"
>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates that the model's parsed JSON response matches the expected
 * ContentBrief fields before it's ever spread into the persisted brief.
 * This is the code-level backstop that keeps the trusted, code-computed
 * fields (id, status, ideaId, ideaText, brandPillar) safe from being
 * silently overwritten by a stray same-named key in the model's response —
 * e.g. a wayward "status": "approved" bypassing the human-review gate.
 * Returns a clean object containing ONLY the validated fields.
 */
function validateContentBriefShape(parsed: unknown, raw: string): ContentBriefFields {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Content brief response is not a JSON object. Raw response: ${raw}`);
  }

  const p = parsed as Record<string, unknown>;
  const errors: string[] = [];

  const requiredStringFields = [
    "editorialTerritory",
    "hook",
    "coreMessage",
    "culturalInsight",
    "educationalValue",
    "cta",
  ] as const;
  for (const field of requiredStringFields) {
    if (!isNonEmptyString(p[field])) {
      errors.push(`"${field}" must be a non-empty string`);
    }
  }

  if (p.personalStory !== undefined && !isNonEmptyString(p.personalStory)) {
    errors.push(`"personalStory" must be a non-empty string when present, or omitted entirely`);
  }

  if (errors.length > 0) {
    throw new Error(`Content brief response failed shape validation:\n- ${errors.join("\n- ")}\nRaw response: ${raw}`);
  }

  const brief: ContentBriefFields = {
    editorialTerritory: p.editorialTerritory as string,
    hook: p.hook as string,
    coreMessage: p.coreMessage as string,
    culturalInsight: p.culturalInsight as string,
    educationalValue: p.educationalValue as string,
    cta: p.cta as string,
  };
  if (p.personalStory !== undefined) brief.personalStory = p.personalStory as string;
  return brief;
}

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
  idea: LibraryIdea,
  canonicalArticle: string,
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

## Approved canonical article — factual and cultural source of truth
${canonicalArticle}

---

## Approved idea to develop
- ID: ${idea.ideaId}
- Question: ${idea.ideaText}
- Core insight: ${idea.coreInsight}
${idea.whyItMatters ? `- Why it matters: ${idea.whyItMatters}\n` : ""}- Source article: ${idea.sourceArticleId}

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

  const approvedIdeas = await loadApprovedIdeas();
  if (approvedIdeas.length === 0) {
    console.log(
      `Hay ${allIdeas.length} ideas en la librería, pero ninguna está aprobada. Cambiá **Status:** a approved después de revisarlas.`
    );
    return;
  }

  const usedIdeaIds = await loadUsedIdeaIds();
  const unusedIdeas = approvedIdeas.filter((idea) => !usedIdeaIds.has(idea.ideaId));
  if (unusedIdeas.length === 0) {
    console.log("Todas las ideas de la librería ya tienen un Content Brief. Agregá más ideas con `npm run generate:ideas`.");
    return;
  }

  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();
  const pillarNames = brand.pillars.map((p) => p.name);
  if (pillarNames.length === 0) {
    throw new Error(
      "data/brand.json tiene pillars: [] — no hay brand pillars para asignar a los briefs. Agregá al menos uno."
    );
  }
  const selected = unusedIdeas.slice(0, BRIEFS_PER_RUN);

  console.log(`Generando ${selected.length} briefs desde la Idea Library (${unusedIdeas.length} ideas sin usar disponibles)...`);

  for (let i = 0; i < selected.length; i++) {
    const idea = selected[i]!;
    const brandPillar = pillarNames[i % pillarNames.length]!;
    const canonicalArticle = await loadBrandBrainArticle(idea.articleSlug);
    const prompt = buildPrompt(brand, idea, canonicalArticle, brandPillar, brandBrain, reelExamples);
    const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-content-brief-generator" });

    let text = result.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) text = fenced[1].trim();

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Failed to parse content brief JSON response: ${err instanceof Error ? err.message : err}\nRaw response: ${text}`
      );
    }
    const parsed = validateContentBriefShape(parsedRaw, text);

    const brief: ContentBrief = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending_review",
      ideaId: idea.ideaId,
      ideaText: idea.ideaText,
      sourceArticleId: idea.sourceArticleId,
      sourceArticleSlug: idea.articleSlug,
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
