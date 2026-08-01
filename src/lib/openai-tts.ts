import { writeFile } from "node:fs/promises";
import { parseBuffer } from "music-metadata";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

export interface TtsOptions {
  apiKey: string;
  model: string;
  voice: string;
  format?: "mp3" | "aac" | "opus" | "flac" | "wav" | "pcm";
}

async function requestSpeech(text: string, options: TtsOptions): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      voice: options.voice,
      input: text,
      response_format: options.format ?? "mp3",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`OpenAI TTS error ${res.status}: ${body}`) as Error & {
      status: number;
    };
    error.status = res.status;
    throw error;
  }

  return Buffer.from(await res.arrayBuffer());
}

async function requestSpeechWithRetry(text: string, options: TtsOptions): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await requestSpeech(text, options);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const transient = status === undefined || TRANSIENT_STATUS_CODES.has(status);
      if (!transient || attempt === 2) throw err;
      const delayMs = 2 ** attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("unreachable");
}

export interface GeneratedClip {
  path: string;
  durationSeconds: number;
}

export async function generateSpeechClip(
  text: string,
  destinationPath: string,
  options: TtsOptions
): Promise<GeneratedClip> {
  const audio = await requestSpeechWithRetry(text, options);
  await writeFile(destinationPath, audio);
  const metadata = await parseBuffer(audio, "audio/mpeg");
  const durationSeconds = metadata.format.duration ?? 0;
  return { path: destinationPath, durationSeconds };
}
