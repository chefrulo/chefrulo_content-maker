import { spawnSync } from "node:child_process";
import { readData } from "../lib/data.js";
import type { ReelScript } from "../types/reel-script.js";

function runStep(label: string, npmScript: string, args: string[]): void {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("npm", ["run", npmScript, "--", ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n"${label}" falló (exit ${result.status}). Frenando el pipeline.`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run pipeline:produce <briefId>");
    return;
  }

  const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} está en status "${brief.status}", no "approved". Corré \`npm run scripts:approve ${id}\` primero.`
    );
    return;
  }

  runStep("1/3 — Generando voiceover", "generate:voiceover", [id]);
  runStep("2/3 — Armando EDL (footage o text cards)", "generate:edl", [id]);
  runStep("3/3 — Renderizando video", "render:reel", [id]);

  console.log(`\n=== CHECKPOINT: revisión del video final ===`);
  console.log(`Mirá data/exports/${id}.mp4 antes de publicar.`);
  console.log(`Cuando esté OK: npm run publish:reel ${id}`);
  console.log(`(ese paso te va a pedir confirmación explícita antes de publicar de verdad)`);
}

main();
