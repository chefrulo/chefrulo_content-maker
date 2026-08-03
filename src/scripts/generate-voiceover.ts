import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import { generateSpeechClip } from "../lib/openai-tts.js";
import type { ReelScript } from "../types/reel-script.js";
import type { VoiceoverTimeline, VoiceoverBeat } from "../types/voiceover.js";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:voiceover <briefId>");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in .env.local");
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "marin";

  const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} todavía está en status "${brief.status}". Corré \`npm run scripts:approve ${id}\` primero.`
    );
    return;
  }

  const outDir = path.resolve(process.cwd(), "data", "voiceovers", id);
  await mkdir(outDir, { recursive: true });

  const voicedCount = brief.beats.filter((b) => b.voiceover).length;
  console.log(
    `Generando voiceover para "${brief.hook}" (${brief.beats.length} beats, ${voicedCount} con voz, voz: ${voice})...`
  );

  const beats: VoiceoverBeat[] = [];
  let cursor = 0;

  for (let i = 0; i < brief.beats.length; i++) {
    const beat = brief.beats[i]!;

    if (!beat.voiceover) {
      const durationSeconds = beat.estimatedSeconds;
      beats.push({
        index: i,
        text: "",
        audioPath: "",
        startSeconds: cursor,
        durationSeconds,
      });
      cursor += durationSeconds;
      console.log(`  beat ${i}: ${durationSeconds.toFixed(2)}s (sin voz) — [${beat.visual.slice(0, 60)}]`);
      continue;
    }

    const audioPath = path.join(outDir, `beat-${i}.mp3`);
    const clip = await generateSpeechClip(beat.voiceover, audioPath, { apiKey, model, voice });
    beats.push({
      index: i,
      text: beat.voiceover,
      audioPath: path.relative(process.cwd(), audioPath),
      startSeconds: cursor,
      durationSeconds: clip.durationSeconds,
    });
    cursor += clip.durationSeconds;
    console.log(`  beat ${i}: ${clip.durationSeconds.toFixed(2)}s — "${beat.voiceover.slice(0, 60)}"`);
  }

  const timeline: VoiceoverTimeline = {
    briefId: id,
    generatedAt: new Date().toISOString(),
    voice,
    model,
    totalDurationSeconds: cursor,
    beats,
  };

  await writeData(`voiceovers/${id}/timeline.json`, timeline);
  console.log(`\nTotal: ${cursor.toFixed(2)}s -> data/voiceovers/${id}/timeline.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
