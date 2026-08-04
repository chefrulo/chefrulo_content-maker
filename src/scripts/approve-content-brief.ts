import { contentBriefRepository } from "../repositories/operational-repository.js";

async function listBriefs() {
  const briefs = await contentBriefRepository.list();
  console.log("Uso: npm run briefs:approve <id> [--reject]\n");
  if (briefs.length === 0) {
    console.log("No hay content briefs. Corré `npm run generate:briefs` primero.");
    return;
  }
  console.log("Content briefs disponibles:");
  for (const brief of briefs) {
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
  const brief = await contentBriefRepository.get(id);
  brief.status = reject ? "rejected" : "approved";
  await contentBriefRepository.save(brief);
  console.log(`Content brief ${id} ${reject ? "rechazado" : "aprobado"}: "${brief.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
