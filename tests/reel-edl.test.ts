import test from "node:test";
import assert from "node:assert/strict";
import { attachScriptPaths, normalizeEdlAssignments } from "../src/lib/reel-edl.ts";

const footage = [
  { filename: "fire.mp4", durationSeconds: 10 },
  { filename: "short.mov", durationSeconds: 2 },
];

test("EDL cuts use exact voiceover duration and stay inside the source clip", () => {
  const beats = normalizeEdlAssignments([
    { beatIndex: 0, filename: "fire.mp4", trimStartSeconds: 8, trimEndSeconds: 99 },
  ], [4], footage);

  assert.equal(beats[0]?.kind, "clip");
  assert.equal(beats[0]?.trimStartSeconds, 6);
  assert.equal(beats[0]?.trimEndSeconds, 10);
  assert.equal(beats[0]?.targetDurationSeconds, 4);
  assert.match(beats[0]?.warning ?? "", /ajustó/);
});

test("EDL falls back to a text card when a clip is missing or too short", () => {
  const beats = normalizeEdlAssignments([
    { beatIndex: 0, filename: "short.mov", trimStartSeconds: 0 },
    { beatIndex: 1, filename: "missing.mp4", trimStartSeconds: 0 },
  ], [3, 2], footage);

  assert.equal(beats[0]?.kind, "textcard");
  assert.match(beats[0]?.warning ?? "", /necesita/);
  assert.equal(beats[1]?.kind, "textcard");
  assert.match(beats[1]?.warning ?? "", /no está disponible/);
});

test("EDL paths are attached only after the script ID is known", () => {
  const beats = normalizeEdlAssignments([
    { beatIndex: 0, filename: "fire.mp4", trimStartSeconds: 1 },
  ], [3], footage);
  const withPaths = attachScriptPaths("script-123", beats);

  assert.equal(withPaths[0]?.clipPath, "footage/script-123/fire.mp4");
});
