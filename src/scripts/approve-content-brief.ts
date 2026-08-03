import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import type { ContentBrief } from "../types/content-brief.js";

async function listBriefs() {
  const dir = path.resolve(process.cwd(), "data", "content-briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }
  console.log("Uso: npm run briefs:approve <id> [--reject]\n");
  if (files.length === 0) {
    console.log("No hay content briefs en data/content-briefs/. Corré `npm run generate:briefs` primero.");
    return;
  }
  console.log("Content briefs disponibles:");
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readData<ContentBrief>(`content-briefs/${file}`);
    console.log(`  [${brief.status}] ${brief.id}  (${brief.brandPillar}) "${brief.hook}"`);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    await listBriefs();
    return;
  }

  const reject = process.argv.includes("--reject");
  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  brief.status = reject ? "rejected" : "approved";
  await writeData(`content-briefs/${id}.json`, brief);
  console.log(`Content brief ${id} ${reject ? "rechazado" : "aprobado"}: "${brief.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
