# Reel production architecture

This document describes the implemented production flow that turns an
approved `ReelScript` into a reviewed video. Reel production is independent
from carousel generation: reels use voice, footage, an edit decision list
(EDL) and Remotion; carousels use HTML/CSS slides and PNG export.

```text
approved ReelScript
        ↓
recorded voice or OpenAI TTS
        ↓
exact per-beat timeline
        ↓
visual footage analysis + proposed EDL
        ↓
human review and EDL approval
        ↓
Remotion render
        ↓
current-render check + explicit publish confirmation
```

## 1. Script beats

The approved script defines one real shot per beat. Each beat separates the
shot direction (`visual`), spoken words (`voiceover`), optional overlay
(`onScreenText`) and an initial time estimate (`estimatedSeconds`). The
estimate guides script writing only; it is not the final edit duration.

## 2. Exact voice timeline

Preparation first runs `generate:voiceover`. For each voiced beat it prefers a
recording made in the application and otherwise generates OpenAI TTS. Recorded
and generated files are measured, producing exact `startSeconds` and
`durationSeconds` values in `data/voiceovers/<script-id>/timeline.json`.
Silent beats retain the script's estimated duration.

The timeline is the timing authority for the edit and final render.

## 3. Footage inventory and visual contacts

Footage lives in `footage/<script-id>/` and can be MP4, MOV or M4V. Content
Maker reads each source file's exact duration and uses headless Chromium to
capture frames at approximately 20%, 50% and 80% of the clip. Sharp combines
those frames into one contact sheet under
`data/edl-assets/<script-id>/`.

Claude receives:

- every script shot direction;
- the exact voice duration required for each beat;
- each available filename and source duration;
- the local path of each contact sheet.

Claude is allowed only the `Read` tool for this task and is instructed to
inspect the contact sheets before assigning footage. A filename remains a
useful label, but is no longer the only visual signal.

## 4. EDL contract and validation

Claude proposes one assignment per beat:

```json
{
  "beatIndex": 0,
  "filename": "lighting-the-fire.mp4",
  "trimStartSeconds": 2.4,
  "trimEndSeconds": 6.1
}
```

Content Maker, not Claude, computes the authoritative end point as:

```text
trimEndSeconds = trimStartSeconds + exactVoiceDuration
```

It constrains the start so the complete interval remains inside the source
clip. Missing or too-short sources become text cards with an explicit warning.
The resulting EDL is saved as `draft`; generation cannot approve its own edit.

## 5. Human review

The reel screen displays, for every beat:

- shot direction and spoken line;
- exact target duration;
- assigned clip or text-card fallback;
- three-frame contact sheet and complete source-video preview;
- editable source clip and trim start;
- computed trim end and source duration;
- adjustment or missing-footage warnings.

The user may save a draft or explicitly save and approve the EDL. Selecting a
clip shorter than the required duration is disabled. Editing an assignment
returns the EDL to `draft` unless it is explicitly approved in the same save.

## 6. Render and publish safety

`render:reel` refuses to run unless:

- the script is approved;
- the EDL is approved;
- a voice timeline exists;
- the EDL references the current voice-timeline generation.

Remotion uses the timeline's exact start and duration and applies both
`trimBefore` and `trimAfter` to the selected video. Text cards remain a
deliberate fallback for beats without suitable footage.

Changing and approving the EDL makes an older MP4 stale. The interface marks
it as outdated, disables publishing, and asks for a new render. The publishing
script repeats that freshness check at the command boundary so the UI cannot
be bypassed accidentally.

## Operational entry points

- `POST /api/scripts/<id>/prepare`: generate voice timeline and draft EDL.
- `PATCH /api/scripts/<id>/edl`: save or approve reviewed assignments.
- `POST /api/scripts/<id>/render`: render an approved current EDL.
- `GET /api/scripts/<id>/media`: local contact-sheet and video preview.
- `npm run pipeline:produce <id>`: CLI preparation up to the review checkpoint.

## Relevant files

- `src/scripts/generate-voiceover.ts`: exact voice timeline.
- `src/scripts/generate-edl.ts`: Claude proposal prompt and orchestration.
- `src/lib/reel-edl.ts`: footage inventory, visual contacts and cut validation.
- `src/components/EdlEditor.tsx`: human review surface.
- `src/scripts/render-reel.ts`: render preconditions and input assembly.
- `src/remotion/ReelComposition.tsx`: final per-beat composition.
- `src/scripts/publish-reel.ts`: freshness and approval guard before publishing.
