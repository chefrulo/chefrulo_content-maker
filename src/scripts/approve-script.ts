import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import type { ReelScript } from "../types/reel-script.js";

async function listScripts() {
  const dir = path.resolve(process.cwd(), "data", "reel-scripts");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }
  console.log("Uso: npm run scripts:approve <id> [--reject]\n");
  if (files.length === 0) {
    console.log("No hay guiones en data/reel-scripts/. Corré `npm run generate:script -- <contentBriefId>` primero.");
    return;
  }
  console.log("Guiones disponibles:");
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const script = await readData<ReelScript>(`reel-scripts/${file}`);
    console.log(`  [${script.status}] ${script.id}  (${script.brandPillar}) "${script.hook}"`);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    await listScripts();
    return;
  }

  const reject = process.argv.includes("--reject");
  const script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  script.status = reject ? "rejected" : "approved";
  await writeData(`reel-scripts/${id}.json`, script);
  console.log(`Guion ${id} ${reject ? "rechazado" : "aprobado"}: "${script.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
