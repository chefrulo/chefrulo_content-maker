import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { InspirationScrapeResult } from "../types/inspiration.js";

async function loadAllReels() {
  const dir = path.resolve(process.cwd(), "data", "inspiration-reels");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const all: Array<{ handle: string; caption: string; likesCount: number; commentsCount: number; videoDuration: number | null }> = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const result = await readDataSafe<InspirationScrapeResult | null>(`inspiration-reels/${file}`, null);
    if (!result) continue;
    for (const reel of result.reels) {
      all.push({
        handle: result.handle,
        caption: reel.caption,
        likesCount: reel.likesCount,
        commentsCount: reel.commentsCount,
        videoDuration: reel.videoDuration,
      });
    }
  }
  return all;
}

function buildPrompt(reels: Awaited<ReturnType<typeof loadAllReels>>): string {
  const block = reels
    .map((r) => `- @${r.handle} (${r.likesCount} likes, ${r.commentsCount} comments${r.videoDuration ? `, ${r.videoDuration}s` : ""}): "${r.caption.slice(0, 200).replace(/\n/g, " ")}"`)
    .join("\n");

  return `You are a social media market analyst. Below are recent reels from Argentine food / asado / pop-up culture creators on Instagram — NOT the brand you work for, just market data to analyze.

${block}

## Task
Analyze ONLY what's happening in this content — you are not generating any content ideas, topics, scripts, or anything attributed to any specific brand. This is pure market intelligence for humans to read.

Respond with ONLY a raw JSON object (no markdown fences, no prose before or after), with this shape:
{
  "topHookPatterns": ["<short description of a hook style that recurs, with an example>", ...],
  "avgDurationSeconds": <number, estimated from the data available>,
  "ctaPatterns": ["<recurring CTA style>", ...],
  "emotionalPatterns": ["<recurring emotional tone or angle>", ...],
  "postingFrequencyNotes": "<brief note on cadence if inferable, else 'not enough data'>",
  "saturatedTopics": ["<topic that appears repeatedly across creators>", ...],
  "emergingOpportunities": ["<a gap or underused angle observed>", ...]
}`;
}

async function main() {
  const reels = await loadAllReels();
  if (reels.length === 0) {
    console.log("No hay reels en data/inspiration-reels/. Corré `npm run scrape:inspiration` primero.");
    return;
  }

  console.log(`Analizando ${reels.length} reels para el trend report...`);
  const prompt = buildPrompt(reels);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-trend-report" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const parsed = JSON.parse(text);

  const date = new Date().toISOString().slice(0, 10);
  const report = { generatedAt: new Date().toISOString(), reelsAnalyzed: reels.length, ...parsed };
  await writeData(`trend-reports/${date}.json`, report);
  console.log(`Trend report guardado en data/trend-reports/${date}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
