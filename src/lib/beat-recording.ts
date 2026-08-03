import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const RECORDED_MARKER = ".recorded.";

export function voiceoverDir(scriptId: string): string {
  return path.resolve(process.cwd(), "data", "voiceovers", scriptId);
}

function recordedPrefix(index: number): string {
  return `beat-${index}${RECORDED_MARKER}`;
}

export async function findRecordedBeatFile(scriptId: string, index: number): Promise<string | null> {
  const dir = voiceoverDir(scriptId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }
  const prefix = recordedPrefix(index);
  const match = files.find((f) => f.startsWith(prefix));
  return match ? path.join(dir, match) : null;
}

export async function deleteRecordedBeatFiles(scriptId: string, index: number): Promise<void> {
  const dir = voiceoverDir(scriptId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  const prefix = recordedPrefix(index);
  await Promise.all(
    files.filter((f) => f.startsWith(prefix)).map((f) => unlink(path.join(dir, f)))
  );
}

export async function listRecordedBeatIndices(scriptId: string): Promise<number[]> {
  const dir = voiceoverDir(scriptId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const indices = new Set<number>();
  for (const f of files) {
    const match = f.match(/^beat-(\d+)\.recorded\./);
    if (match?.[1]) indices.add(Number(match[1]));
  }
  return [...indices].sort((a, b) => a - b);
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

export function extensionFromContentType(contentType: string): string {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSION_BY_CONTENT_TYPE[base] ?? "webm";
}

export function contentTypeFromExtension(ext: string): string {
  return CONTENT_TYPE_BY_EXTENSION[ext.toLowerCase()] ?? "application/octet-stream";
}
