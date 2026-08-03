# Voice recording design

## Problem

Voiceover today is always AI-generated (OpenAI TTS), for every beat that has a
`voiceover` line. There's no way to skip narration for a whole reel without
still requiring `OPENAI_API_KEY`, and no way to use your own recorded voice
instead of the AI voice.

## Goals

- Per beat, three coexisting options: AI voice (default, unchanged), your own
  recording, or no voice at all (already possible today when a beat has no
  `voiceover` text).
- Record your own voice from the browser, on the script detail page.
- `OPENAI_API_KEY` only required when it's actually needed (at least one
  voiced beat without a recording).
- No changes to the script schema (`ReelScript`/`ReelBeat`) or to
  `render-reel.ts` / the Remotion composition — a beat's audio source stays
  an implementation detail of how `data/voiceovers/<id>/beat-N.*` got there.

Note: beats (and therefore this feature) live on `ReelScript` — the
beat-by-beat stage that comes after an abstract `ContentBrief` is approved
and turned into a script via `generate:script`. `ContentBrief` has no beats,
so this feature only applies once a script exists.

## Design

### Source of truth: files on disk

Presence of a file is the signal, not a new field on the brief. Before
generating TTS for beat `i`, `generate-voiceover.ts` checks whether
`data/voiceovers/<id>/beat-<i>.recorded.*` already exists (glob by prefix,
extension varies by browser — see below). If it does, that file is used
directly: duration is measured with `music-metadata` (already a dependency,
already used for TTS clip duration in `openai-tts.ts`), and no API call is
made. If it doesn't, behavior is unchanged (call TTS).

This means render-reel.ts and the `VoiceoverTimeline`/`VoiceoverBeat` types
need zero changes — a beat with a recording is indistinguishable at render
time from a beat with a TTS clip; both are just `audioPath` + duration.

### API routes (mirrors existing `/api/exports/[id]` and `/api/scripts/[id]` patterns)

- `PUT /api/scripts/[id]/beats/[index]/recording` — body is the recorded
  audio blob. Validates `index` is a real beat with `voiceover` set. Saves to
  `data/voiceovers/<id>/beat-<index>.recorded.<ext>`, where `<ext>` is
  derived from the upload's content type (webm for Chrome, mp4/m4a for
  Safari) rather than hardcoded.
- `GET /api/scripts/[id]/beats/[index]/recording` — streams the file back for
  playback, 404 if none.
- `DELETE /api/scripts/[id]/beats/[index]/recording` — removes the file;
  next `generate:voiceover` run falls back to TTS for that beat.
- `GET /api/scripts/[id]` — extended to also return `recordedBeats: number[]`
  (beat indices that currently have a recording), computed the same way
  `hasVideo` already is, via `existsSync`/glob.

No separate "list recordings" endpoint — `recordedBeats` on the existing
script-detail response is enough.

### UI: `BeatRecorder` component

Rendered inside each beat's list item on `src/app/scripts/[id]/page.tsx`,
only for beats where `beat.voiceover` is set. Three states:

- **No recording** — "🎙 Grabar mi voz" button. Requests the mic
  (`getUserMedia`) and starts a `MediaRecorder`.
- **Recording** — "■ Detener" button, with a pulsing indicator and elapsed
  seconds. No waveform, no live level meter.
- **Recorded** — inline `<audio controls>` for playback, plus "Rehacer"
  (re-record, overwrites) and "Usar voz IA" (calls DELETE, reverts to TTS).

No in-browser trimming/editing of the take — "Rehacer" is the only fix-up
mechanism, which is enough for redoing a bad take.

Mic-permission or no-device errors show a simple inline message ("No se
pudo acceder al micrófono") — no retry flow; this is a rare case the user
already knows how to resolve (grant permission, plug in a mic).

### `generate-voiceover.ts` changes

1. Before requiring `OPENAI_API_KEY`, check whether any voiced beat lacks a
   `beat-<i>.recorded.*` file. Only require the key if at least one does.
2. Inside the per-beat loop, for beats with `voiceover`: look for
   `beat-<i>.recorded.*` first (via `readdir` + prefix filter). If found,
   measure duration with `music-metadata` and use it directly, skipping the
   TTS call. Otherwise, unchanged TTS path.
3. Per-beat console log now distinguishes three cases instead of two:
   `(sin voz)`, `(grabación propia, Xs)`, `(voz IA, Xs)`.

## Edge cases

- Deleting a recording after a timeline was already generated with it: the
  next `generate:voiceover` run regenerates that beat via TTS automatically
  — no extra cleanup needed.
- Orphaned recordings (e.g. if a brief were ever regenerated) are harmless —
  simply unreferenced files on disk.
- Two overlapping recordings for the same beat can't happen — the "Detener"
  button replaces "Grabar" for the duration of a take.

## Out of scope (YAGNI)

- File upload as an alternative to browser recording (decided against —
  browser recording only, for now).
- Per-brief single-mode toggle (decided against — per-beat granularity only).
- Muting a beat that already has `voiceover` text via the UI (existing
  silence is only set at brief-generation time; not part of this feature).
- Waveform visualization, in-browser trimming/editing of takes.
