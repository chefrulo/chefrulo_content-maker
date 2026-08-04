import { config } from "dotenv";
config({ path: ".env.local" });

import path from "node:path";
import { writeData, readDataSafe } from "../lib/data.js";
import { reelScriptRepository } from "../repositories/operational-repository.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import { attachScriptPaths, listFootage, normalizeEdlAssignments, type EdlAssignmentInput } from "../lib/reel-edl.js";
import type { Edl } from "../types/edl.js";
import type { VoiceoverTimeline } from "../types/voiceover.js";

function parseAssignments(raw: string): EdlAssignmentInput[] {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`Could not find a JSON array in Claude's response:\n${raw}`);
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Claude's EDL response is not an array");
  return parsed.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`EDL assignment ${index} is invalid`);
    const item = value as Record<string, unknown>;
    if (!Number.isInteger(item.beatIndex)) throw new Error(`EDL assignment ${index} has an invalid beatIndex`);
    if (item.filename !== null && typeof item.filename !== "string") throw new Error(`EDL assignment ${index} has an invalid filename`);
    return {
      beatIndex: item.beatIndex as number,
      filename: item.filename as string | null,
      trimStartSeconds: typeof item.trimStartSeconds === "number" ? item.trimStartSeconds : 0,
      trimEndSeconds: typeof item.trimEndSeconds === "number" ? item.trimEndSeconds : undefined,
    };
  });
}

async function assignFootage(
  script: Awaited<ReturnType<typeof reelScriptRepository.get>>,
  timeline: VoiceoverTimeline,
  clips: Awaited<ReturnType<typeof listFootage>>
): Promise<EdlAssignmentInput[]> {
  const beatsBlock = script.beats.map((beat, index) => {
    const timing = timeline.beats.find((item) => item.index === index);
    if (!timing) throw new Error(`Missing voiceover timing for beat ${index}`);
    return `${index}: Visual: "${beat.visual}"\n   Exact target duration: ${timing.durationSeconds.toFixed(2)}s`;
  }).join("\n");
  const clipsBlock = clips.map((clip) => [
    `- ${clip.filename} (${clip.durationSeconds.toFixed(2)}s)`,
    clip.contactSheetPath ? `  Visual contact sheet: ${path.resolve(process.cwd(), clip.contactSheetPath)}` : "  No contact sheet available; use the filename cautiously.",
  ].join("\n")).join("\n");

  const prompt = `You are editing a short Instagram Reel. Match real footage to every beat.

BEATS — durations below come from the actual recorded or generated voiceover and are exact:
${beatsBlock}

AVAILABLE FOOTAGE:
${clipsBlock}

Inspect every available contact-sheet image with the Read tool before choosing clips. Do not rely only on filenames when a contact sheet exists.

For each beat, choose the best-matching footage file, or null when nothing genuinely fits. A file may be reused. The chosen source clip must be at least as long as the beat's exact target duration. Pick trimStartSeconds so the complete target-duration window remains inside the source clip; trimEndSeconds must equal trimStartSeconds plus the exact target duration.

Respond with ONLY a raw JSON array, one item per beat in beat order:
[{ "beatIndex": 0, "filename": "<exact filename or null>", "trimStartSeconds": 0, "trimEndSeconds": 4.25 }]`;

  const { result } = await runClaudeAgent({
    prompt,
    allowedTools: ["Read"],
    maxBudgetUsd: 0.3,
    name: "chefrulo-edl",
  });
  const assignments = parseAssignments(result);
  const indices = assignments.map((assignment) => assignment.beatIndex);
  if (assignments.length !== script.beats.length || new Set(indices).size !== script.beats.length || indices.some((index) => index < 0 || index >= script.beats.length)) {
    throw new Error("Claude debe devolver exactamente una asignación válida por cada beat.");
  }
  return assignments;
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:edl <scriptId>");
    return;
  }

  const script = await reelScriptRepository.get(id);
  if (script.status !== "approved") throw new Error(`El guion ${id} debe estar aprobado antes de preparar el montaje.`);

  const timeline = await readDataSafe<VoiceoverTimeline | null>(`voiceovers/${id}/timeline.json`, null);
  if (!timeline) throw new Error(`No hay timeline de voz para ${id}. Corré \`npm run generate:voiceover ${id}\` primero.`);
  if (timeline.beats.length !== script.beats.length) throw new Error("La timeline de voz no coincide con los beats del guion.");

  const clips = await listFootage(id, { createContactSheets: true });
  console.log(`Footage disponible para ${id}: ${clips.length} clips`);
  const targetDurations = script.beats.map((_, index) => {
    const timing = timeline.beats.find((beat) => beat.index === index);
    if (!timing) throw new Error(`Missing voiceover timing for beat ${index}`);
    return timing.durationSeconds;
  });

  let assignments: EdlAssignmentInput[];
  if (clips.length === 0) {
    console.log(`No hay footage en footage/${id}/ — se proponen text cards para los ${script.beats.length} beats.`);
    assignments = script.beats.map((_, beatIndex) => ({ beatIndex, filename: null }));
  } else {
    assignments = await assignFootage(script, timeline, clips);
  }

  const now = new Date().toISOString();
  const beats = attachScriptPaths(id, normalizeEdlAssignments(assignments, targetDurations, clips));
  const edl: Edl = {
    briefId: id,
    generatedAt: now,
    updatedAt: now,
    voiceoverGeneratedAt: timeline.generatedAt,
    status: "draft",
    footage: clips,
    beats,
  };
  await writeData(`edl/${id}.json`, edl);

  for (const beat of beats) {
    console.log(`  beat ${beat.index}: ${beat.kind}${beat.filename ? ` — ${beat.filename} [${beat.trimStartSeconds?.toFixed(2)}s-${beat.trimEndSeconds?.toFixed(2)}s]` : ""}${beat.warning ? ` ⚠ ${beat.warning}` : ""}`);
  }
  console.log(`\nEDL guardado como borrador en data/edl/${id}.json. Revisalo y aprobalo desde la aplicación antes de renderizar.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
