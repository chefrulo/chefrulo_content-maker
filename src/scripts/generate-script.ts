import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { loadBrandBrainFoundation, loadBrandBrainReelExamples } from "../lib/brand-brain.js";
import { loadLatestTrendReport } from "../lib/trend-report.js";
import { readData, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";
import type { ReelBeat, ReelScript } from "../types/reel-script.js";

type ReelScriptFields = Pick<ReelScript, "topic" | "contentPattern" | "beats" | "estimatedDurationSeconds">;

interface TrendPresentationSummary {
  topHookPatterns: string[];
  avgDurationSeconds: number | null;
  ctaPatterns: string[];
  postingFrequencyNotes: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Extracts ONLY the presentation-relevant fields from the raw trend report
 * JSON — topHookPatterns, avgDurationSeconds, ctaPatterns,
 * postingFrequencyNotes. Deliberately drops saturatedTopics,
 * emergingOpportunities and emotionalPatterns, which describe WHAT to talk
 * about rather than how to present it: this script must never let market
 * research influence topic, only hook phrasing, pacing and CTA style. The
 * trend report file was already shape-validated when generate-trend-report.ts
 * wrote it, but this is treated defensively anyway — the report is optional
 * enrichment, so any parse/shape problem here just means proceeding without
 * it rather than failing script generation.
 */
function extractPresentationTrendFields(raw: string | null): TrendPresentationSummary | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const p = parsed as Record<string, unknown>;
  const topHookPatterns = isStringArray(p.topHookPatterns) ? p.topHookPatterns : [];
  const ctaPatterns = isStringArray(p.ctaPatterns) ? p.ctaPatterns : [];
  const avgDurationSeconds =
    typeof p.avgDurationSeconds === "number" && Number.isFinite(p.avgDurationSeconds) ? p.avgDurationSeconds : null;
  const postingFrequencyNotes = typeof p.postingFrequencyNotes === "string" ? p.postingFrequencyNotes : "";

  if (topHookPatterns.length === 0 && ctaPatterns.length === 0 && avgDurationSeconds === null && !postingFrequencyNotes) {
    return null;
  }

  return { topHookPatterns, avgDurationSeconds, ctaPatterns, postingFrequencyNotes };
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateBeat(value: unknown, index: number, errors: string[]): ReelBeat | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`beats[${index}] must be an object`);
    return null;
  }

  const b = value as Record<string, unknown>;
  const beatErrors: string[] = [];

  if (!isNonEmptyString(b.visual)) {
    beatErrors.push(`beats[${index}].visual must be a non-empty string`);
  }
  if (!isFinitePositiveNumber(b.estimatedSeconds)) {
    beatErrors.push(`beats[${index}].estimatedSeconds must be a finite positive number`);
  }
  if (b.voiceover !== undefined && typeof b.voiceover !== "string") {
    beatErrors.push(`beats[${index}].voiceover must be a string when present, or omitted entirely`);
  }
  if (b.onScreenText !== undefined && typeof b.onScreenText !== "string") {
    beatErrors.push(`beats[${index}].onScreenText must be a string when present, or omitted entirely`);
  }

  if (beatErrors.length > 0) {
    errors.push(...beatErrors);
    return null;
  }

  const beat: ReelBeat = {
    visual: b.visual as string,
    estimatedSeconds: b.estimatedSeconds as number,
  };
  if (b.voiceover !== undefined) beat.voiceover = b.voiceover as string;
  if (b.onScreenText !== undefined) beat.onScreenText = b.onScreenText as string;
  return beat;
}

/**
 * Validates that the model's parsed JSON response matches the expected
 * ReelScript beat fields before it's ever spread into the persisted script.
 * This is the code-level backstop that keeps the trusted, code-computed
 * fields (id, status, contentBriefId, brandPillar, editorialTerritory, hook,
 * cta, inspiredBy) safe from being silently overwritten by a stray
 * same-named key in the model's response. Returns a clean object containing
 * ONLY the validated fields.
 */
function validateReelScriptShape(parsed: unknown, raw: string): ReelScriptFields {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Reel script response is not a JSON object. Raw response: ${raw}`);
  }

  const p = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(p.topic)) {
    errors.push(`"topic" must be a non-empty string`);
  }
  if (!isNonEmptyString(p.contentPattern)) {
    errors.push(`"contentPattern" must be a non-empty string`);
  }

  let beats: ReelBeat[] = [];
  if (!Array.isArray(p.beats) || p.beats.length === 0) {
    errors.push(`"beats" must be a non-empty array`);
  } else {
    const validated = p.beats.map((beat, index) => validateBeat(beat, index, errors));
    if (errors.length === 0) {
      beats = validated as ReelBeat[];
      if (!beats.some((beat) => beat.voiceover || beat.onScreenText)) {
        errors.push(
          `"beats" cannot all be silent — at least one beat must have a "voiceover" or "onScreenText"`
        );
      }
    }
  }

  if (!isFinitePositiveNumber(p.estimatedDurationSeconds)) {
    errors.push(`"estimatedDurationSeconds" must be a finite positive number`);
  }

  if (errors.length > 0) {
    throw new Error(`Reel script response failed shape validation:\n- ${errors.join("\n- ")}\nRaw response: ${raw}`);
  }

  return {
    topic: p.topic as string,
    contentPattern: p.contentPattern as string,
    beats,
    estimatedDurationSeconds: p.estimatedDurationSeconds as number,
  };
}

function buildPrompt(
  brand: Awaited<ReturnType<typeof getBrand>>,
  brief: ContentBrief,
  brandBrain: string | null,
  reelExamples: string | null,
  trendSummary: TrendPresentationSummary | null
): string {
  const brandBrainBlock = brandBrain
    ? `## Editorial foundation — non-negotiable, overrides everything below if they ever conflict
Every beat's voiceover and onScreenText must follow this — British English, the specific voice described, and especially the guardrails (never claim cultural superiority in either direction, never treat one household/region as representative of all Argentina, never use "authentic" as an unsupported verdict, never imitate accents or use stereotypes, never let a hook shame the audience or conceal the subject).

${brandBrain}

---
`
    : "";

  const reelExamplesBlock = reelExamples
    ? `## Gold-standard reel examples — not optional inspiration
The examples below are approved reference briefs. They define the expected level of specificity, curiosity, cultural insight, emotional restraint and narrative clarity. Generate a script comparable to these, while NEVER copying their wording, hooks or topics, and NEVER inventing personal memories, people or quotations that aren't already grounded in the brand brain above or in the approved brief below.

${reelExamples}

---
`
    : "";

  const trendReportBlock = trendSummary
    ? `## Current market trends — for PRESENTATION STYLE ONLY, never for topic
The topic, message and cultural insight are already fixed by the approved brief below — do not let this section change what the piece is about. This is deliberately NOT the full trend report — only presentation-style signals are included below (no topic or opportunity data), so use it only to inform hook phrasing style, pacing, typical duration and CTA phrasing.

- Typical hook patterns observed: ${trendSummary.topHookPatterns.length > 0 ? trendSummary.topHookPatterns.join("; ") : "not enough data"}
- Typical duration: ${trendSummary.avgDurationSeconds !== null ? `${trendSummary.avgDurationSeconds}s` : "not enough data"}
- Typical CTA phrasing patterns: ${trendSummary.ctaPatterns.length > 0 ? trendSummary.ctaPatterns.join("; ") : "not enough data"}
- Posting cadence notes: ${trendSummary.postingFrequencyNotes || "not enough data"}

---
`
    : "";

  return `You are a senior Instagram Reels content strategist for "${brand.name}", turning one already-approved Content Brief into a beat-by-beat reel script.

${brandBrainBlock}${reelExamplesBlock}${trendReportBlock}## Approved Content Brief
- Hook: ${brief.hook}
- Core message: ${brief.coreMessage}
- Cultural insight: ${brief.culturalInsight}
${brief.personalStory ? `- Personal story: ${brief.personalStory}\n` : ""}- Educational value: ${brief.educationalValue}
- CTA: ${brief.cta}
- Brand pillar: ${brief.brandPillar}
- Editorial territory: ${brief.editorialTerritory}

## Task
Break this brief into a sequence of beats. A beat is ONE shot of real footage. For each beat, separate three things that must never be mixed into one string:
- "visual": what the camera shows (a direction for whoever is filming/editing — never spoken, never on screen as text)
- "voiceover": the exact words a narrator says out loud for this beat, or omit the field entirely if this beat is silent
- "onScreenText": short text overlay shown during this beat, or omit if none

Respond with ONLY a raw JSON object (no markdown fences, no prose before or after), with this shape:
{
  "topic": "<one-sentence restatement of what this piece covers>",
  "contentPattern": "<the structural pattern used, e.g. Cultural Doorway, Useful Correction, Myth-busting>",
  "beats": [
    { "visual": "<shot direction>", "voiceover": "<spoken line, omit if silent>", "onScreenText": "<overlay text, omit if none>", "estimatedSeconds": <integer, 2-8> }
  ],
  "estimatedDurationSeconds": <integer, 15-60, should roughly equal the sum of beat estimatedSeconds>
}`;
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:script -- <contentBriefId>");
    return;
  }

  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  if (brief.status !== "approved") {
    console.log(`El brief ${id} todavía está en status "${brief.status}". Corré \`npm run briefs:approve ${id}\` primero.`);
    return;
  }

  const brand = await getBrand();
  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();
  const trendReportRaw = await loadLatestTrendReport();
  const trendSummary = extractPresentationTrendFields(trendReportRaw);

  console.log(`Generando guion para "${brief.hook}"...`);
  const prompt = buildPrompt(brand, brief, brandBrain, reelExamples, trendSummary);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-script-generator" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Failed to parse reel script JSON response: ${err instanceof Error ? err.message : err}\nRaw response: ${text}`
    );
  }
  const parsed = validateReelScriptShape(parsedRaw, text);

  const script: ReelScript = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending_review",
    contentBriefId: brief.id,
    brandPillar: brief.brandPillar,
    editorialTerritory: brief.editorialTerritory,
    hook: brief.hook,
    cta: brief.cta,
    inspiredBy: [],
    ...parsed,
  };
  await writeData(`reel-scripts/${script.id}.json`, script);
  console.log(`\nGuion guardado en data/reel-scripts/${script.id}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
