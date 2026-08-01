import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { loadBrandBrainFoundation, loadBrandBrainReelExamples } from "../lib/brand-brain.js";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { InspirationScrapeResult, InspirationReel } from "../types/inspiration.js";
import type { ReelBrief } from "../types/brief.js";

const BRIEFS_PER_RUN = 5;
const TOP_REELS_FOR_CONTEXT = 12;

async function loadTopInspirationReels(): Promise<
  Array<InspirationReel & { handle: string }>
> {
  const dir = path.resolve(process.cwd(), "data", "inspiration-reels");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const all: Array<InspirationReel & { handle: string }> = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const result = await readDataSafe<InspirationScrapeResult | null>(
      `inspiration-reels/${file}`,
      null
    );
    if (!result) continue;
    for (const reel of result.reels) {
      all.push({ ...reel, handle: result.handle });
    }
  }

  all.sort((a, b) => b.likesCount + b.commentsCount - (a.likesCount + a.commentsCount));
  return all.slice(0, TOP_REELS_FOR_CONTEXT);
}

function buildPrompt(
  brand: Awaited<ReturnType<typeof getBrand>>,
  reels: Array<InspirationReel & { handle: string }>,
  brandBrain: string | null,
  reelExamples: string | null
): string {
  const pillarsBlock = brand.pillars
    .map(
      (p) =>
        `- ${p.name}: ${p.description}\n  Example angles: ${p.exampleAngles.join("; ")}`
    )
    .join("\n");

  const pillarNames = brand.pillars.map((p) => p.name);

  const reelsBlock = reels
    .map(
      (r) =>
        `- @${r.handle} (${r.likesCount} likes, ${r.commentsCount} comments${r.videoPlayCount ? `, ${r.videoPlayCount} plays` : ""}): "${r.caption.slice(0, 200).replace(/\n/g, " ")}"`
    )
    .join("\n");

  const brandBrainBlock = brandBrain
    ? `## Editorial foundation — non-negotiable, overrides everything below if they ever conflict
The following is Chef Rulo's brand brain: positioning, editorial manifesto, writing style and guardrails. Every beat's voiceover and onScreenText must follow this — British English, the specific voice described, and especially the guardrails (never claim cultural superiority in either direction, never treat one household/region as representative of all Argentina, never use "authentic" as an unsupported verdict, never imitate accents or use stereotypes, never let a hook shame the audience or conceal the subject).

${brandBrain}

---
`
    : "";

  const reelExamplesBlock = reelExamples
    ? `## Gold-standard reel examples — not optional inspiration
The examples below are approved reference briefs, already in the exact output shape you must produce. They define the expected level of specificity, curiosity, cultural insight, emotional restraint and narrative clarity. Generate briefs that feel structurally and editorially comparable to these, while NEVER copying their wording, hooks or topics, and NEVER inventing personal memories, people or quotations that aren't already grounded in the brand brain above.

${reelExamples}

---
`
    : "";

  return `You are a senior Instagram Reels content strategist for the brand "${brand.name}".

${brandBrainBlock}## Brand
- Positioning: ${brand.positioning}
- Tagline: ${brand.tagline}
- Location: ${brand.location}
- Tone: ${brand.toneKeywords.join(", ")}
- Target audience: ${brand.targetAudience}
- Offerings: ${brand.offerings.join(", ")}

## Brand pillars (commercial — which facet of the brand this piece develops; for planning and business reporting)
${pillarsBlock}

## Editorial territories vs brand pillars
A brief needs BOTH, and they are not the same axis:
- "brandPillar" is one of the brand pillar names listed above.
- "editorialTerritory" is the concrete subject-matter territory the piece is actually about (e.g. "Argentine Cooking Techniques", "Family Memory", "Argentine Table Culture") — pick or coin one that fits the topic, informed by the brand brain's content taxonomy if included below. The same brand pillar can pair with several different territories; don't force a rigid one-to-one mapping.
- "topic" is the specific, concrete idea for this piece (a sentence, not a category).
- "contentPattern" is the structural pattern used (e.g. "Cultural Doorway", "Technique", "Useful Correction", "Myth-busting", "Day in the Life" — draw from the brand brain's content patterns when included below, otherwise use a sensible short label).

## CTA styles to draw from
${brand.ctaStyles.join(", ")}

## Top-performing reels from inspiration accounts (Argentine food / asado / pop-up culture creators — NOT direct competitors, just accounts whose content style and engagement patterns are worth learning from)
${reelsBlock}

${reelExamplesBlock}## Task
Generate exactly ${BRIEFS_PER_RUN} reel briefs for "${brand.name}", each grounded in a DIFFERENT brand pillar (rotate through: ${pillarNames.join(", ")}), taking inspiration from what's working in the reels listed above (hook style, pacing, format) WITHOUT copying them — adapt the pattern to Chef Rulo's own voice and offerings.

Each brief is a sequence of beats. A beat is ONE shot of real footage. For each beat, separate three things that must never be mixed into one string:
- "visual": what the camera shows (a direction for whoever is filming/editing — never spoken, never on screen as text)
- "voiceover": the exact words a narrator says out loud for this beat, or omit the field entirely if this beat is silent (just visuals + on-screen text + ambient sound)
- "onScreenText": short text overlay shown during this beat (captions/labels), or omit if none
A beat can have voiceover only, onScreenText only, both, or neither (pure visual/ambient beat) — but never put stage directions like "Text on screen:" inside voiceover.

Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), where each item has exactly this shape:
{
  "brandPillar": "<one of the brand pillar names above>",
  "editorialTerritory": "<concrete subject-matter territory, see above>",
  "topic": "<the specific topic this piece covers, one sentence>",
  "contentPattern": "<the structural pattern used, see above>",
  "hook": "<the core attention-grabbing idea in under 8 words — used as reference, not spoken verbatim unless it's also a beat's voiceover>",
  "beats": [
    { "visual": "<shot direction>", "voiceover": "<spoken line, omit if silent>", "onScreenText": "<overlay text, omit if none>", "estimatedSeconds": <integer, 2-8> }
  ],
  "cta": "<one of the CTA styles above, or a natural variant>",
  "estimatedDurationSeconds": <integer, 15-60, should roughly equal the sum of beat estimatedSeconds>,
  "inspiredBy": ["<handle of the inspiration account(s) whose pattern informed this brief>"]
}`;
}

function parseBriefsJson(raw: string): Array<Omit<ReelBrief, "id" | "createdAt" | "status">> {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find a JSON array in Claude's response:\n${raw}`);
  }
  text = text.slice(start, end + 1);

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of briefs");
  }
  return parsed;
}

async function main() {
  const brand = await getBrand();
  const reels = await loadTopInspirationReels();
  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();

  if (reels.length === 0) {
    console.log(
      "No hay reels de inspiración en data/inspiration-reels/. Corré `npm run scrape:inspiration` primero."
    );
    return;
  }

  console.log(
    `Generando ${BRIEFS_PER_RUN} briefs usando ${reels.length} reels de referencia` +
      (brandBrain ? " y el brand brain" : " (sin brand brain — seteá BRAND_BRAIN_PATH en .env.local)") +
      (reelExamples ? " + ejemplos gold-standard" : " (sin ejemplos gold-standard en knowledge/40-patterns/)") +
      "..."
  );

  const prompt = buildPrompt(brand, reels, brandBrain, reelExamples);
  const { result } = await runClaudeAgent({
    prompt,
    maxBudgetUsd: 0.5,
    name: "chefrulo-brief-generator",
  });

  const rawBriefs = parseBriefsJson(result);

  for (const raw of rawBriefs) {
    const brief: ReelBrief = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending_review",
      ...raw,
    };
    await writeData(`briefs/${brief.id}.json`, brief);
    console.log(`  [${brief.brandPillar} / ${brief.editorialTerritory}] "${brief.hook}" -> data/briefs/${brief.id}.json`);
  }

  console.log(`\n${rawBriefs.length} briefs guardados en data/briefs/, status: pending_review.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
