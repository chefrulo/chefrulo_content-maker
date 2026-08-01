import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { getVideoMetadata } from "@remotion/renderer";
import { readData, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ReelBrief } from "../types/brief.js";
import type { Edl, EdlBeat } from "../types/edl.js";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v"]);

interface FootageClip {
  filename: string;
  durationSeconds: number;
}

async function listFootage(briefId: string): Promise<FootageClip[]> {
  const dir = path.resolve(process.cwd(), "footage", briefId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const clips: FootageClip[] = [];
  for (const filename of files) {
    if (!VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase())) continue;
    const metadata = await getVideoMetadata(path.join(dir, filename));
    clips.push({ filename, durationSeconds: metadata.durationInSeconds ?? 0 });
  }
  return clips;
}

interface ClaudeAssignment {
  beatIndex: number;
  filename: string | null;
  trimStartSeconds: number;
  trimEndSeconds: number;
}

function parseAssignments(raw: string): ClaudeAssignment[] {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find a JSON array in Claude's response:\n${raw}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function assignFootageToBeats(
  brief: ReelBrief,
  clips: FootageClip[]
): Promise<Map<number, ClaudeAssignment>> {
  const beatsBlock = brief.beats
    .map((b, i) => `${i}: "${b.visual}" (~${b.estimatedSeconds}s)`)
    .join("\n");
  const clipsBlock = clips
    .map((c) => `- ${c.filename} (${c.durationSeconds.toFixed(1)}s)`)
    .join("\n");

  const prompt = `You are editing a short Instagram Reel. Here are the shot descriptions for each beat:
${beatsBlock}

Here is the available real footage (filenames and their full duration):
${clipsBlock}

For each beat, pick the best-matching footage file (a file can be reused for multiple beats if needed), or null if nothing fits. Suggest a trim window (trimStartSeconds, trimEndSeconds) within that file's duration that roughly matches the beat's target length.

Respond with ONLY a raw JSON array (no markdown fences, no prose), one item per beat, in beat order:
[{ "beatIndex": 0, "filename": "<filename or null>", "trimStartSeconds": 0, "trimEndSeconds": 4 }]`;

  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-edl" });
  const assignments = parseAssignments(result);
  return new Map(assignments.map((a) => [a.beatIndex, a]));
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:edl <briefId>");
    return;
  }

  const brief = await readData<ReelBrief>(`briefs/${id}.json`);
  if (brief.status !== "approved") {
    console.log(
      `El brief ${id} todavía está en status "${brief.status}". Corré \`npm run briefs:approve ${id}\` primero.`
    );
    return;
  }

  const clips = await listFootage(id);
  console.log(`Footage disponible para ${id}: ${clips.length} clips`);

  let beats: EdlBeat[];

  if (clips.length === 0) {
    console.log(
      `No hay footage en footage/${id}/ todavía — armo el EDL con text cards para los ${brief.beats.length} beats. Agregá clips ahí y volvé a correr este script cuando los tengas.`
    );
    beats = brief.beats.map((_, index) => ({ index, kind: "textcard" as const }));
  } else {
    const assignments = await assignFootageToBeats(brief, clips);
    beats = brief.beats.map((_, index) => {
      const assignment = assignments.get(index);
      if (!assignment?.filename || !clips.some((c) => c.filename === assignment.filename)) {
        return { index, kind: "textcard" as const };
      }
      return {
        index,
        kind: "clip" as const,
        clipPath: path.join("footage", id, assignment.filename),
        trimStartSeconds: assignment.trimStartSeconds,
        trimEndSeconds: assignment.trimEndSeconds,
      };
    });
  }

  const edl: Edl = { briefId: id, generatedAt: new Date().toISOString(), beats };
  await writeData(`edl/${id}.json`, edl);

  for (const beat of beats) {
    console.log(
      `  beat ${beat.index}: ${beat.kind}${beat.clipPath ? ` — ${beat.clipPath} [${beat.trimStartSeconds}s-${beat.trimEndSeconds}s]` : ""}`
    );
  }
  console.log(`\nEDL guardado en data/edl/${id}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
