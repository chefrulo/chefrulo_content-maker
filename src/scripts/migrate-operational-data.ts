import {
  contentBriefRepository,
  ideaProposalRepository,
  reelScriptRepository,
} from "../repositories/operational-repository.js";

async function main() {
  const [briefs, scripts, proposals] = await Promise.all([
    contentBriefRepository.list(),
    reelScriptRepository.list(),
    ideaProposalRepository.list(),
  ]);
  console.log("SQLite operational store ready:");
  console.log(`  Content briefs: ${briefs.length}`);
  console.log(`  Reel scripts: ${scripts.length}`);
  console.log(`  Idea proposal batches: ${proposals.length}`);
  console.log("Legacy JSON files were preserved and are imported only when an ID is missing.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
