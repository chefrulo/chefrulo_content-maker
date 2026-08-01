import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData } from "../lib/data.js";
import type { ReelBrief } from "../types/brief.js";

function runStep(label: string, npmScript: string): void {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("npm", ["run", npmScript], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n"${label}" falló (exit ${result.status}). Frenando el pipeline.`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  runStep("1/2 — Research: scraping cuentas de inspiración", "scrape:inspiration");
  runStep("2/2 — Generando briefs", "generate:briefs");

  const dir = path.resolve(process.cwd(), "data", "briefs");
  const files = await readdir(dir).catch(() => [] as string[]);
  const pending: ReelBrief[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readData<ReelBrief>(`briefs/${file}`);
    if (brief.status === "pending_review") pending.push(brief);
  }

  console.log(`\n=== CHECKPOINT: revisión manual ===`);
  console.log(`${pending.length} briefs esperando aprobación:\n`);
  for (const brief of pending) {
    console.log(`  [${brief.brandPillar} / ${brief.editorialTerritory}] ${brief.id}`);
    console.log(`    "${brief.hook}"`);
  }
  console.log(`\nRevisá los JSON en data/briefs/, y para cada uno que quieras producir:`);
  console.log(`  npm run briefs:approve <id>`);
  console.log(`  npm run pipeline:produce <id>`);
}

main();
