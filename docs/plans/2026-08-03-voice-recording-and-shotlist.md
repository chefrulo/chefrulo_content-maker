# Voice Recording & Shot List PDF Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the user record their own voice per beat (instead of always using OpenAI TTS) on the `ReelScript` detail page, and download a print-ready PDF shot list of a script's beats.

**Architecture:** Presence of a file on disk (`data/voiceovers/<id>/beat-<i>.recorded.*`) is the source of truth for "this beat uses a recording" — no new field on `ReelScript`. A shared `src/lib/beat-recording.ts` module centralizes the file-finding/naming logic used by both the new API route and `generate-voiceover.ts`. The shot list PDF is generated server-side per request via `@react-pdf/renderer`, no persistence.

**Tech Stack:** Next.js 16 App Router API routes, React 19 client components (`MediaRecorder`/`getUserMedia`), `@react-pdf/renderer` (new dependency), `music-metadata` (existing dependency, already used for TTS clip duration).

**Testing note:** This project has no test runner configured (confirmed: no `test` script, no test files anywhere). Verification is `npx tsc --noEmit -p .`, `npm run lint`, and manual smoke tests (`npm run dev` + browser) — several tasks require an actual microphone/browser interaction to verify, which is called out explicitly where relevant.

---

### Task 1: Shared beat-recording lib

**Files:**
- Create: `src/lib/beat-recording.ts`

**Step 1: Write the implementation**

```ts
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
```

**Step 2: Sanity-check the pure functions manually**

```bash
node --experimental-strip-types -e '
import("./src/lib/beat-recording.ts").then((m) => {
  console.log(m.extensionFromContentType("audio/webm;codecs=opus")); // webm
  console.log(m.extensionFromContentType("audio/mp4"));               // mp4
  console.log(m.extensionFromContentType("audio/x-bogus"));           // webm (fallback)
  console.log(m.contentTypeFromExtension("webm"));                    // audio/webm
  console.log(m.contentTypeFromExtension("bogus"));                   // application/octet-stream
});
'
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/beat-recording.ts
git commit -m "feat: add shared beat-recording file lookup helpers"
```

---

### Task 2: Recording upload/playback/delete API route

**Files:**
- Create: `src/app/api/scripts/[id]/beats/[index]/recording/route.ts`

**Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { readData } from "@/lib/data";
import {
  voiceoverDir,
  findRecordedBeatFile,
  deleteRecordedBeatFiles,
  extensionFromContentType,
  contentTypeFromExtension,
} from "@/lib/beat-recording";
import type { ReelScript } from "@/types/reel-script";

async function loadScriptAndValidateBeat(
  id: string,
  indexParam: string
): Promise<{ script: ReelScript; index: number } | { error: string; status: number }> {
  const index = Number(indexParam);
  if (!Number.isInteger(index) || index < 0) {
    return { error: "Invalid beat index", status: 400 };
  }

  let script: ReelScript;
  try {
    script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  } catch {
    return { error: "Script not found", status: 404 };
  }

  const beat = script.beats[index];
  if (!beat) {
    return { error: "Beat not found", status: 404 };
  }
  if (!beat.voiceover) {
    return { error: "This beat has no voiceover line to record", status: 400 };
  }

  return { script, index };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  const result = await loadScriptAndValidateBeat(id, indexParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const ext = extensionFromContentType(contentType);
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty recording" }, { status: 400 });
  }

  const dir = voiceoverDir(id);
  await mkdir(dir, { recursive: true });
  await deleteRecordedBeatFiles(id, result.index);
  await writeFile(path.join(dir, `beat-${result.index}.recorded.${ext}`), buffer);

  return NextResponse.json({ ok: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  const index = Number(indexParam);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid beat index" }, { status: 400 });
  }

  const filePath = await findRecordedBeatFile(id, index);
  if (!filePath) {
    return NextResponse.json({ error: "No recording found" }, { status: 404 });
  }

  const ext = filePath.split(".").pop() ?? "";
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    headers: { "Content-Type": contentTypeFromExtension(ext) },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  const result = await loadScriptAndValidateBeat(id, indexParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await deleteRecordedBeatFiles(id, result.index);
  return NextResponse.json({ ok: true });
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 3: Manual smoke test with curl (no browser needed for this step)**

This requires a real `ReelScript` with at least one voiced beat to exist in
`data/reel-scripts/`. If none exists in this environment, skip this step —
it will be covered by the full browser smoke test in the final task.

```bash
# Replace <id> and <beatIndex> with a real script id / voiced beat index
curl -X PUT "http://localhost:3000/api/scripts/<id>/beats/<beatIndex>/recording" \
  -H "Content-Type: audio/wav" \
  --data-binary "@/dev/null"
# Expected: 400 "Empty recording" (dev/null is 0 bytes) — this just confirms
# the route is wired and validating, not a real upload.
```

**Step 4: Commit**

```bash
git add "src/app/api/scripts/[id]/beats/[index]/recording/route.ts"
git commit -m "feat: add beat recording upload/playback/delete API route"
```

---

### Task 3: Extend script detail API with `recordedBeats`

**Files:**
- Modify: `src/app/api/scripts/[id]/route.ts`

**Step 1: Add the field to the response**

Current file:

```ts
import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { readData } from "@/lib/data";
import type { ReelScript } from "@/types/reel-script";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
    const hasVideo = existsSync(path.resolve(process.cwd(), "data", "exports", `${id}.mp4`));
    return NextResponse.json({ brief, hasVideo });
  } catch {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
}
```

Replace with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { readData } from "@/lib/data";
import { listRecordedBeatIndices } from "@/lib/beat-recording";
import type { ReelScript } from "@/types/reel-script";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
    const hasVideo = existsSync(path.resolve(process.cwd(), "data", "exports", `${id}.mp4`));
    const recordedBeats = await listRecordedBeatIndices(id);
    return NextResponse.json({ brief, hasVideo, recordedBeats });
  } catch {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 3: Commit**

```bash
git add "src/app/api/scripts/[id]/route.ts"
git commit -m "feat: include recordedBeats in script detail API response"
```

---

### Task 4: `BeatRecorder` component

**Files:**
- Create: `src/components/BeatRecorder.tsx`

**Step 1: Write the component**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface BeatRecorderProps {
  scriptId: string;
  beatIndex: number;
  initiallyRecorded: boolean;
  onChange?: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function BeatRecorder({ scriptId, beatIndex, initiallyRecorded, onChange }: BeatRecorderProps) {
  const [hasRecording, setHasRecording] = useState(initiallyRecorded);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordingUrl = `/api/scripts/${scriptId}/beats/${beatIndex}/recording?v=${version}`;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    const mimeType = pickMimeType();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        try {
          const res = await fetch(`/api/scripts/${scriptId}/beats/${beatIndex}/recording`, {
            method: "PUT",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          if (!res.ok) throw new Error("upload failed");
          setHasRecording(true);
          setVersion((v) => v + 1);
          onChange?.();
        } catch {
          setError("No se pudo guardar la grabación.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setError("No se pudo acceder al micrófono.");
    }
  }, [scriptId, beatIndex, onChange]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopTimer();
  }, []);

  const deleteRecording = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/beats/${beatIndex}/recording`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setHasRecording(false);
      onChange?.();
    } catch {
      setError("No se pudo borrar la grabación.");
    }
  }, [scriptId, beatIndex, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 pl-6">
      {isRecording ? (
        <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
          <Square className="h-3.5 w-3.5" /> Detener ({elapsedSeconds}s)
        </Button>
      ) : hasRecording ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- short voiceover takes, no captions needed */}
          <audio controls src={recordingUrl} className="h-8" />
          <Button type="button" variant="outline" size="sm" onClick={startRecording}>
            <RotateCcw className="h-3.5 w-3.5" /> Rehacer
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={deleteRecording}>
            <Sparkles className="h-3.5 w-3.5" /> Usar voz IA
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={startRecording}>
          <Mic className="h-3.5 w-3.5" /> Grabar mi voz
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .` and `npm run lint`
Expected: no errors. (This component isn't wired into any page yet — that's
Task 5 — so it won't be exercised at runtime until then, but it must compile
and lint clean standalone.)

**Step 3: Commit**

```bash
git add src/components/BeatRecorder.tsx
git commit -m "feat: add BeatRecorder component"
```

---

### Task 5: Wire `BeatRecorder` into the script detail page

**Files:**
- Modify: `src/app/scripts/[id]/page.tsx`

**Step 1: Add `recordedBeats` state and load it**

In the component, add a new piece of state and read it from the existing
`load()` function's response (the API already returns it as of Task 3):

```tsx
const [recordedBeats, setRecordedBeats] = useState<number[]>([]);
```

Inside `load()`, after `setHasVideo(data.hasVideo);`, add:

```tsx
setRecordedBeats(data.recordedBeats ?? []);
```

**Step 2: Import `BeatRecorder` and render it per beat**

Add the import:

```tsx
import { BeatRecorder } from "@/components/BeatRecorder";
```

In the beats `<ol>`, inside each `<li>`, after the existing
`estimatedSeconds` paragraph, add:

```tsx
{beat.voiceover && (
  <BeatRecorder
    scriptId={id}
    beatIndex={i}
    initiallyRecorded={recordedBeats.includes(i)}
    onChange={load}
  />
)}
```

So the full `<li>` becomes:

```tsx
<li key={i} className="rounded-lg border border-border bg-surface p-3 space-y-1.5">
  <div className="flex items-start gap-2 text-sm">
    <Clapperboard className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
    <span>{beat.visual}</span>
  </div>
  {beat.voiceover && (
    <div className="flex items-start gap-2 text-sm text-accent">
      <Mic className="h-4 w-4 mt-0.5 shrink-0" />
      <span>&ldquo;{beat.voiceover}&rdquo;</span>
    </div>
  )}
  {beat.onScreenText && (
    <div className="flex items-start gap-2 text-sm font-medium">
      <Type className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <span>{beat.onScreenText}</span>
    </div>
  )}
  <p className="text-[10px] text-muted-foreground pl-6">~{beat.estimatedSeconds}s</p>
  {beat.voiceover && (
    <BeatRecorder
      scriptId={id}
      beatIndex={i}
      initiallyRecorded={recordedBeats.includes(i)}
      onChange={load}
    />
  )}
</li>
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .` and `npm run lint`
Expected: no errors.

**Step 4: Manual browser smoke test**

This is the first point where the recording feature can be exercised
end-to-end, but it requires a real approved-or-any-status `ReelScript` with
at least one voiced beat to exist in `data/reel-scripts/`, and a working
microphone in the browser used for testing.

Run: `npm run dev`, navigate to `/scripts/<a real script id>`, and for a beat
with a voiceover line:
1. Click "Grabar mi voz" — browser should prompt for mic permission (grant it).
2. Speak briefly, click "Detener".
3. Expected: an `<audio>` player appears with your recording, playable.
4. Click "Rehacer" — should let you record again, replacing the previous take.
5. Click "Usar voz IA" — should remove the recording, button reverts to "Grabar mi voz".

If no real script data exists in this environment, skip this manual step —
it's covered again in the final full-verification task, where test data can
be set up if needed.

**Step 5: Commit**

```bash
git add "src/app/scripts/[id]/page.tsx"
git commit -m "feat: wire BeatRecorder into the script detail page"
```

---

### Task 6: `generate-voiceover.ts` — recorded-file-first, conditional API key

**Files:**
- Modify: `src/scripts/generate-voiceover.ts`

**Step 1: Replace the file contents**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import { readData, writeData } from "../lib/data.js";
import { generateSpeechClip } from "../lib/openai-tts.js";
import { findRecordedBeatFile } from "../lib/beat-recording.js";
import type { ReelScript } from "../types/reel-script.js";
import type { VoiceoverTimeline, VoiceoverBeat } from "../types/voiceover.js";

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
      const metadata = await parseFile(recordedFile);
      const durationSeconds = metadata.format.duration ?? 0;
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
```

Note: `mkdir(outDir, { recursive: true })` now happens BEFORE the recorded-file
lookup, same as before — this doesn't affect the lookup (the recording, if
any, would already exist in that same directory from a prior `PUT` via the
web UI, and `mkdir` on an existing directory is a harmless no-op).

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 3 [COSTS MONEY if it actually calls TTS — run only when ready]:**

If you have a real approved `ReelScript` in `data/reel-scripts/` with no
recordings for any of its voiced beats, running
`npm run generate:voiceover -- <id>` will call the real OpenAI TTS API
(costs money). Skip running this unless you want to verify end-to-end.

If you DO want to verify without spending money: create a `ReelScript` where
every beat either has no `voiceover` or already has a recorded file at
`data/voiceovers/<id>/beat-<i>.recorded.<ext>` (e.g. from Task 5's manual
browser test) — running the command in that case should complete without
ever requiring `OPENAI_API_KEY` or making a network call, which is the
specific behavior this task adds. Confirm the console log shows
"(grabación propia)" for the recorded beat(s) and no TTS-related error even
with `OPENAI_API_KEY` unset in `.env.local`.

**Step 4: Commit**

```bash
git add src/scripts/generate-voiceover.ts
git commit -m "feat: generate-voiceover.ts uses recordings when present, skips TTS/API key when unneeded"
```

---

### Task 7: Add `@react-pdf/renderer` dependency

**Files:**
- Modify: `package.json` (and `package-lock.json`, via `npm install`)

**Step 1: Install**

```bash
npm install @react-pdf/renderer
```

Let `npm` resolve and pin the current version — don't hand-edit a version
number into `package.json`.

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors (nothing imports it yet — that's Task 8).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-pdf/renderer dependency"
```

---

### Task 8: Shot list PDF route

**Files:**
- Create: `src/app/api/scripts/[id]/shotlist/route.tsx`

Note the `.tsx` extension — this file contains JSX (the PDF document
components), so it cannot be `route.ts`. Next.js resolves route handlers
from `route.{js,jsx,ts,tsx}`, so `route.tsx` is picked up the same way.

**Step 1: Write the route**

```tsx
import { NextRequest } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { readData } from "@/lib/data";
import type { ReelScript } from "@/types/reel-script";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  hook: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  topic: { fontSize: 10, color: "#555555" },
  beat: { marginBottom: 12, paddingBottom: 8, borderBottom: "1 solid #dddddd" },
  beatHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  beatNumber: { fontSize: 10, color: "#888888" },
  duration: { fontSize: 10, color: "#888888" },
  visual: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  voiceover: { fontSize: 11, fontStyle: "italic", color: "#333333" },
});

function ShotlistDocument({ script }: { script: ReelScript }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hook}>{script.hook}</Text>
          <Text style={styles.topic}>{script.topic}</Text>
        </View>
        {script.beats.map((beat, i) => (
          <View key={i} style={styles.beat}>
            <View style={styles.beatHeader}>
              <Text style={styles.beatNumber}>Beat {i + 1}</Text>
              <Text style={styles.duration}>~{beat.estimatedSeconds}s</Text>
            </View>
            <Text style={styles.visual}>{beat.visual}</Text>
            {beat.voiceover && <Text style={styles.voiceover}>&quot;{beat.voiceover}&quot;</Text>}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let script: ReelScript;
  try {
    script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderToBuffer(<ShotlistDocument script={script} />);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${id}-shotlist.pdf"`,
    },
  });
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `@react-pdf/renderer`'s actual type definitions
differ slightly from what's used here (e.g. a style property name), fix the
specific mismatch — the overall structure (Document/Page/View/Text,
StyleSheet.create, renderToBuffer) is stable across recent versions.

**Step 3: Manual smoke test**

This requires a real `ReelScript` to exist in `data/reel-scripts/`.

Run: `npm run dev`, then:
```bash
curl -s -o /tmp/shotlist-test.pdf "http://localhost:3000/api/scripts/<a real script id>/shotlist"
file /tmp/shotlist-test.pdf
```
Expected: `file` reports a valid PDF (`PDF document, version 1.x`), and the
byte size is non-trivial (more than a few KB, not an error page). Open it
(if you have a way to view PDFs in this environment) and confirm the hook,
topic, and each beat's visual/voiceover/duration render legibly.

**Step 4: Commit**

```bash
git add "src/app/api/scripts/[id]/shotlist/route.tsx"
git commit -m "feat: add shot list PDF route"
```

---

### Task 9: "Descargar PDF" link on the script detail page

**Files:**
- Modify: `src/app/scripts/[id]/page.tsx`

**Step 1: Add the link**

In the `<header>` section, after the `inspiredBy` paragraph (or after the
CTA line if `inspiredBy` is empty), add:

```tsx
<a
  href={`/api/scripts/${id}/shotlist`}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block mt-2 text-xs text-accent hover:underline"
>
  Descargar hoja de rodaje (PDF)
</a>
```

So the header becomes:

```tsx
<header>
  <div className="flex flex-wrap gap-1.5">
    <Badge variant="outline">{brief.brandPillar}</Badge>
    <Badge variant="secondary">{brief.editorialTerritory}</Badge>
  </div>
  <h1 className="text-2xl font-bold mt-2 leading-snug">{brief.hook}</h1>
  <p className="text-sm text-muted-foreground mt-1">{brief.topic}</p>
  <p className="text-sm text-muted-foreground mt-1">
    {brief.contentPattern} · ~{brief.estimatedDurationSeconds}s · CTA: {brief.cta}
  </p>
  {brief.inspiredBy.length > 0 && (
    <p className="text-xs text-muted-foreground mt-1">
      Inspirado en: {brief.inspiredBy.map((h) => `@${h.replace(/^@/, "")}`).join(", ")}
    </p>
  )}
  <a
    href={`/api/scripts/${id}/shotlist`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block mt-2 text-xs text-accent hover:underline"
  >
    Descargar hoja de rodaje (PDF)
  </a>
</header>
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .` and `npm run lint`
Expected: no errors.

**Step 3: Commit**

```bash
git add "src/app/scripts/[id]/page.tsx"
git commit -m "feat: add shot list PDF download link to script detail page"
```

---

### Task 10: Full verification pass

**Step 1: Typecheck and lint**

Run: `npx tsc --noEmit -p .` and `npm run lint`
Expected: both clean.

**Step 2: Manual browser smoke test of both features together**

Run: `npm run dev`, open a real script's detail page
(`/scripts/<id>`, needs at least one voiced beat), and:
1. Confirm the "Descargar hoja de rodaje (PDF)" link appears under the
   header and opens/downloads a valid PDF in a new tab.
2. Confirm each voiced beat shows the `BeatRecorder` control.
3. Record a take on one beat, confirm playback works, confirm "Rehacer" and
   "Usar voz IA" both work as described in Task 5.
4. Reload the page — confirm the recorded beat still shows as recorded
   (i.e. `recordedBeats` correctly persisted and reflected in the initial
   page load, not just client-side state from the recording session).

If no real script data exists in this environment to test against, note
that explicitly rather than skipping silently — this is the one part of the
plan that cannot be fully verified by `tsc`/`lint` alone.

**Step 3: Final commit if anything was fixed during verification**

```bash
git add -A
git commit -m "chore: fix issues found during verification pass"
```
