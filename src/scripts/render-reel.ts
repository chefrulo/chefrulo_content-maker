import { config } from "dotenv";
config({ path: ".env.local" });

import path from "node:path";
import { mkdir, symlink } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getBrand } from "../lib/brand.js";
import { readData, readDataSafe } from "../lib/data.js";
import type { ReelScript } from "../types/reel-script.js";
import type { Edl } from "../types/edl.js";
import type { VoiceoverTimeline } from "../types/voiceover.js";
import type { ReelCompositionProps, RenderBeat } from "../remotion/ReelComposition.js";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run render:reel <briefId>");
    return;
  }

  const brief = await readData<ReelScript>(`briefs/${id}.json`);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} todavía está en status "${brief.status}". Corré \`npm run briefs:approve ${id}\` primero.`
    );
    return;
  }

  const edl = await readDataSafe<Edl | null>(`edl/${id}.json`, null);
  if (!edl) {
    console.log(`No hay EDL para ${id}. Corré \`npm run generate:edl ${id}\` primero.`);
    return;
  }

  const voiceover = await readDataSafe<VoiceoverTimeline | null>(
    `voiceovers/${id}/timeline.json`,
    null
  );
  if (!voiceover) {
    console.log(`No hay voiceover para ${id}. Corré \`npm run generate:voiceover ${id}\` primero.`);
    return;
  }

  const brand = await getBrand();
  const root = process.cwd();

  // Remotion serves assets from publicDir via staticFile(); symlink our real
  // (gitignored) storage dirs in instead of copying media. Uses its own dir
  // (not public/) since that's now the Next.js app's static assets folder.
  const publicDir = path.resolve(root, ".remotion-public");
  await mkdir(publicDir, { recursive: true });
  for (const [link, target] of [
    ["voiceovers", path.resolve(root, "data", "voiceovers")],
    ["footage", path.resolve(root, "footage")],
  ] as const) {
    await mkdir(target, { recursive: true });
    try {
      await symlink(target, path.join(publicDir, link), "dir");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }

  const beats: RenderBeat[] = brief.beats.map((brandBeat, index) => {
    const edlBeat = edl.beats.find((b) => b.index === index);
    const vo = voiceover.beats.find((b) => b.index === index);
    if (!vo) throw new Error(`Missing voiceover timing for beat ${index}`);

    return {
      index,
      startSeconds: vo.startSeconds,
      durationSeconds: vo.durationSeconds,
      kind: edlBeat?.kind === "clip" ? "clip" : "textcard",
      // edlBeat.clipPath is "footage/{id}/file.mp4" -> matches the public/footage symlink
      clipPath: edlBeat?.clipPath,
      trimStartSeconds: edlBeat?.trimStartSeconds,
      onScreenText: brandBeat.onScreenText,
      // vo.audioPath is "data/voiceovers/{id}/beat-N.mp3" -> strip "data/" to match public/voiceovers
      audioPath: vo.audioPath ? path.posix.join(...vo.audioPath.split(path.sep).slice(1)) : undefined,
    };
  });

  const inputProps: ReelCompositionProps = {
    beats,
    totalDurationSeconds: voiceover.totalDurationSeconds,
    brandName: brand.name,
    primaryColor: brand.name ? "#2b1810" : "#1a1a2e",
    accentColor: "#e94560",
    hook: brief.hook,
    cta: brief.cta,
  };

  console.log(`Bundling proyecto Remotion...`);
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "src/remotion/index.ts"),
    publicDir,
    webpackOverride: (webpackConfig) => ({
      ...webpackConfig,
      resolve: {
        ...webpackConfig.resolve,
        extensionAlias: {
          ".js": [".ts", ".tsx", ".js"],
        },
      },
    }),
  });

  console.log(`Resolviendo composición...`);
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Reel",
    inputProps,
  });

  const outDir = path.resolve(root, "data", "exports");
  await mkdir(outDir, { recursive: true });
  const outputLocation = path.join(outDir, `${id}.mp4`);

  console.log(`Renderizando (${composition.durationInFrames} frames @ ${composition.fps}fps)...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  ${Math.round(progress * 100)}%`);
    },
  });

  console.log(`\n\nRenderizado: ${path.relative(root, outputLocation)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
