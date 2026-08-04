import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import { attachScriptPaths, listFootage, normalizeEdlAssignments, type EdlAssignmentInput } from "@/lib/reel-edl";
import { reelScriptRepository } from "@/repositories/operational-repository";
import type { Edl } from "@/types/edl";
import type { VoiceoverTimeline } from "@/types/voiceover";

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin EDL changes are not allowed" }, { status: 403 });
  const { id } = await params;
  try {
    const script = await reelScriptRepository.get(id);
    if (script.status !== "approved") return NextResponse.json({ error: "El guion debe estar aprobado." }, { status: 409 });
    const current = await readData<Edl>(`edl/${id}.json`);
    const timeline = await readData<VoiceoverTimeline>(`voiceovers/${id}/timeline.json`);
    const body = await request.json() as { assignments?: EdlAssignmentInput[]; approve?: boolean };
    if (!Array.isArray(body.assignments) || body.assignments.length !== script.beats.length) {
      return NextResponse.json({ error: "Debe existir una asignación por cada beat." }, { status: 400 });
    }
    const indices = body.assignments.map((assignment) => assignment.beatIndex);
    if (new Set(indices).size !== script.beats.length || indices.some((index) => !Number.isInteger(index) || index < 0 || index >= script.beats.length)) {
      return NextResponse.json({ error: "Los índices de beats no son válidos." }, { status: 400 });
    }

    const footage = await listFootage(id);
    const targets = script.beats.map((_, index) => {
      const timing = timeline.beats.find((beat) => beat.index === index);
      if (!timing) throw new Error(`Falta el tiempo real del beat ${index + 1}. Regenerá la voz y el montaje.`);
      return timing.durationSeconds;
    });
    const beats = attachScriptPaths(id, normalizeEdlAssignments(body.assignments, targets, footage));
    const now = new Date().toISOString();
    const contentChanged = JSON.stringify(beats) !== JSON.stringify(current.beats)
      || current.voiceoverGeneratedAt !== timeline.generatedAt;
    const edl: Edl = {
      ...current,
      updatedAt: contentChanged ? now : current.updatedAt,
      voiceoverGeneratedAt: timeline.generatedAt,
      status: body.approve ? "approved" : "draft",
      footage: footage.map((clip) => ({
        ...clip,
        contactSheetPath: current.footage?.find((item) => item.filename === clip.filename)?.contactSheetPath,
      })),
      beats,
    };
    await writeData(`edl/${id}.json`, edl);
    return NextResponse.json({ edl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el montaje" }, { status: 400 });
  }
}
