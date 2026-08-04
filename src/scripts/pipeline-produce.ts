import { spawnSync } from "node:child_process";
import { reelScriptRepository } from "../repositories/operational-repository.js";

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

  const brief = await reelScriptRepository.get(id);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} está en status "${brief.status}", no "approved". Corré \`npm run scripts:approve ${id}\` primero.`
    );
    return;
  }

  runStep("1/2 — Generando voz y tiempos reales", "generate:voiceover", [id]);
  runStep("2/2 — Proponiendo montaje con footage", "generate:edl", [id]);

  console.log(`\n=== CHECKPOINT: revisión del montaje ===`);
  console.log(`Abrí el guion en la aplicación, revisá los clips y cortes, y aprobá el EDL.`);
  console.log(`Después podés renderizar el video final desde la misma pantalla.`);
}

main();
