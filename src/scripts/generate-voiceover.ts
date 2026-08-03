import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Input, FilePathSource, ALL_FORMATS } from "mediabunny";
import { readData, writeData } from "../lib/data.js";
import { generateSpeechClip } from "../lib/openai-tts.js";
import { findRecordedBeatFile } from "../lib/beat-recording.js";
import type { ReelScript } from "../types/reel-script.js";
import type { VoiceoverTimeline, VoiceoverBeat } from "../types/voiceover.js";

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// Browser MediaRecorder output (webm/opus) is muxed for live streaming and
// routinely omits the container's declared Duration element — this is why a
// fresh recording's `<audio>.duration` famously reads `Infinity` in the
// browser. music-metadata's Matroska parser only reads that declared
// element with no fallback, so it silently returns `undefined` for these
// files. mediabunny's `computeDuration()` instead scans packet timestamps
// directly (the same approach ffprobe's decode path uses), which works
// whether or not the container declares a duration and regardless of
// whether the file has a video track (recorded beats are audio-only, so
// @remotion/renderer's ffmpeg-backed `getVideoMetadata` — which requires a
// video stream and throws "No video stream found" otherwise — is not an
// option here).
async function measureRecordedDuration(filePath: string): Promise<number> {
  const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(filePath) });
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:voiceover <scriptId>");
    return;
  }

  const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} todavía está en status "${brief.status}". Corré \`npm run scripts:approve ${id}\` primero.`
    );
    return;
  }

  const outDir = path.resolve(process.cwd(), "data", "voiceovers", id);
  await mkdir(outDir, { recursive: true });

  const voicedBeatIndices = brief.beats
    .map((beat, index) => ({ beat, index }))
    .filter(({ beat }) => beat.voiceover)
    .map(({ index }) => index);

  const recordedFileByIndex = new Map<number, string>();
  for (const index of voicedBeatIndices) {
    const recorded = await findRecordedBeatFile(id, index);
    if (recorded) recordedFileByIndex.set(index, recorded);
  }

  const needsTts = voicedBeatIndices.some((index) => !recordedFileByIndex.has(index));

  let apiKey = "";
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE || "marin";
  if (needsTts) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set in .env.local");
    apiKey = key;
  }

  const recordedCount = recordedFileByIndex.size;
  console.log(
    `Generando voiceover para "${brief.hook}" (${brief.beats.length} beats, ${voicedBeatIndices.length} con voz — ${recordedCount} grabación propia, ${voicedBeatIndices.length - recordedCount} voz IA: ${voice})...`
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

    const recordedFile = recordedFileByIndex.get(i);
    if (recordedFile) {
      let durationSeconds: number;
      try {
        durationSeconds = await measureRecordedDuration(recordedFile);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Recorded beat ${i} (${recordedFile}) has invalid/unreadable duration: ${reason}`);
      }
      if (!isFinitePositiveNumber(durationSeconds)) {
        throw new Error(`Recorded beat ${i} (${recordedFile}) has invalid/unreadable duration`);
      }
      beats.push({
        index: i,
        text: beat.voiceover,
        audioPath: path.relative(process.cwd(), recordedFile),
        startSeconds: cursor,
        durationSeconds,
      });
      cursor += durationSeconds;
      console.log(`  beat ${i}: ${durationSeconds.toFixed(2)}s (grabación propia) — "${beat.voiceover.slice(0, 60)}"`);
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
    console.log(`  beat ${i}: ${clip.durationSeconds.toFixed(2)}s (voz IA) — "${beat.voiceover.slice(0, 60)}"`);
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
