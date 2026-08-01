import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import type { ReelBrief } from "../types/brief.js";

async function listBriefs() {
  const dir = path.resolve(process.cwd(), "data", "briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }
  console.log("Uso: npm run briefs:approve <id>\n");
  if (files.length === 0) {
    console.log("No hay briefs en data/briefs/. Corré `npm run generate:briefs` primero.");
    return;
  }
  console.log("Briefs disponibles:");
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readData<ReelBrief>(`briefs/${file}`);
    console.log(`  [${brief.status}] ${brief.id}  (${brief.pillar}) "${brief.hook}"`);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    await listBriefs();
    return;
  }

  const brief = await readData<ReelBrief>(`briefs/${id}.json`);
  brief.status = "approved";
  await writeData(`briefs/${id}.json`, brief);
  console.log(`Brief ${id} aprobado: "${brief.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
