import { reelScriptRepository } from "../repositories/operational-repository.js";

async function listScripts() {
  const scripts = await reelScriptRepository.list();
  console.log("Uso: npm run scripts:approve <id> [--reject]\n");
  if (scripts.length === 0) {
    console.log("No hay guiones. Corré `npm run generate:script -- <contentBriefId>` primero.");
    return;
  }
  console.log("Guiones disponibles:");
  for (const script of scripts) {
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
  const script = await reelScriptRepository.get(id);
  if (script.status === "published") {
    console.log(
      `El guion ${id} ya fue publicado el ${script.publishedAt} (media ${script.publishedMediaId}) — no se puede aprobar/rechazar un guion publicado.`
    );
    return;
  }
  script.status = reject ? "rejected" : "approved";
  await reelScriptRepository.save(script);
  console.log(`Guion ${id} ${reject ? "rechazado" : "aprobado"}: "${script.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
