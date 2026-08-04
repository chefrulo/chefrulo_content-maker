import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { brandBrainGateway } from "../lib/brand-brain.js";
import { type LibraryIdea } from "../lib/idea-library.js";
import {
  loadAvailableBriefIdeas,
  parseRequestedIdeaArgs,
  selectRequestedIdeas,
} from "../lib/brief-idea-selection.js";
import { contentBriefRepository } from "../repositories/operational-repository.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";

// Claude CLI guardrail. With the current claude.ai Pro authentication this
// limits usage within the subscription; it is not an estimated per-brief bill.
const CLAUDE_BUDGET_GUARD_USD = 0.3;

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
  const requestedIds = parseRequestedIdeaArgs(process.argv.slice(2));
  const availableIdeas = await loadAvailableBriefIdeas();
  const selected = selectRequestedIdeas(availableIdeas, requestedIds);

  const [brandBrainRevision, brandBrain, reelExamples] = await Promise.all([
    brandBrainGateway.getRevision(),
    brandBrainGateway.loadFoundation(),
    brandBrainGateway.loadReelExamples(),
  ]);
  const pillarNames = brand.pillars.map((p) => p.name);
  if (pillarNames.length === 0) {
    throw new Error(
      "data/brand.json tiene pillars: [] — no hay brand pillars para asignar a los briefs. Agregá al menos uno."
    );
  }
  console.log(`Generando ${selected.length} briefs seleccionados (${availableIdeas.length} ideas aprobadas sin usar disponibles)...`);

  for (let i = 0; i < selected.length; i++) {
    const idea = selected[i]!;
    const brandPillar = pillarNames[i % pillarNames.length]!;
    const canonicalArticle = await brandBrainGateway.loadApprovedArticle(
      idea.articleSlug,
      idea.sourceArticleId
    );
    const prompt = buildPrompt(brand, idea, canonicalArticle, brandPillar, brandBrain, reelExamples);
    const { result } = await runClaudeAgent({
      prompt,
      maxBudgetUsd: CLAUDE_BUDGET_GUARD_USD,
      name: "chefrulo-content-brief-generator",
    });

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
      brandBrainRevision,
      brandPillar,
      ...parsed,
    };
    await contentBriefRepository.save(brief);
    console.log(`  [${brief.brandPillar}] "${brief.hook}" -> SQLite content_brief/${brief.id}`);
  }

  console.log(`\n${selected.length} briefs guardados en SQLite, status: pending_review.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
