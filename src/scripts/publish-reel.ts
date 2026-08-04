import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { reelScriptRepository } from "../repositories/operational-repository.js";
import { publishReel, type PublishConfig } from "../lib/publish-reel.js";
import type { ReelScript } from "../types/reel-script.js";

const REQUIRED_ENV = ["IG_BUSINESS_ACCOUNT_ID", "IG_ACCESS_TOKEN"] as const;

function loadPublishConfig(): PublishConfig {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
  return {
    igBusinessAccountId: process.env.IG_BUSINESS_ACCOUNT_ID!,
    igAccessToken: process.env.IG_ACCESS_TOKEN!,
  };
}

function buildCaption(brief: ReelScript, override?: string): string {
  if (override) return override;
  return `${brief.hook}\n\n${brief.cta}`;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim().toLowerCase() === "publicar";
}

async function main() {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  const skipConfirm = args.includes("--yes");
  const force = args.includes("--force");
  const captionFlagIndex = args.indexOf("--caption");
  const captionOverride = captionFlagIndex !== -1 ? args[captionFlagIndex + 1] : undefined;

  if (!id) {
    console.log('Uso: npm run publish:reel <briefId> [--caption "..."] [--yes] [--force]');
    return;
  }

  const brief = await reelScriptRepository.get(id);

  if (brief.status === "published" && !force) {
    console.log(
      `El brief ${id} ya fue publicado el ${brief.publishedAt} (media ${brief.publishedMediaId}). Usá --force para republicar.`
    );
    return;
  }
  if (brief.status !== "approved" && brief.status !== "published") {
    console.log(
      `El brief ${id} está en status "${brief.status}", no "approved". Corré \`npm run scripts:approve ${id}\` primero.`
    );
    return;
  }

  const videoPath = path.resolve(process.cwd(), "data", "exports", `${id}.mp4`);
  if (!existsSync(videoPath)) {
    console.log(`No existe ${path.relative(process.cwd(), videoPath)}. Corré \`npm run render:reel ${id}\` primero.`);
    return;
  }

  const publishConfig = loadPublishConfig();
  const caption = buildCaption(brief, captionOverride);

  console.log("\n=== A punto de publicar en Instagram ===");
  console.log(`Brief:   ${id} (${brief.brandPillar})`);
  console.log(`Video:   ${path.relative(process.cwd(), videoPath)}`);
  console.log(`Cuenta:  ${publishConfig.igBusinessAccountId}`);
  console.log(`Caption:\n${caption}`);
  console.log("=========================================\n");

  if (!skipConfirm) {
    const confirmed = await confirm('Esto publica en la cuenta real de Instagram AHORA. Escribí "publicar" para confirmar: ');
    if (!confirmed) {
      console.log("Cancelado.");
      return;
    }
  }

  console.log("Abriendo túnel local y publicando...");
  const result = await publishReel(videoPath, caption, publishConfig);

  const updated: ReelScript = {
    ...brief,
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedMediaId: result.mediaId,
    publishedVideoUrl: result.videoUrl,
  };
  await reelScriptRepository.save(updated);

  console.log(`\nPublicado. Media ID: ${result.mediaId}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
