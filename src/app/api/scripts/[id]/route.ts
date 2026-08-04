import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { statSync } from "node:fs";
import path from "node:path";
import { reelScriptRepository } from "@/repositories/operational-repository";
import { listRecordedBeatIndices } from "@/lib/beat-recording";
import { readDataSafe } from "@/lib/data";
import type { Edl } from "@/types/edl";
import type { VoiceoverTimeline } from "@/types/voiceover";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await reelScriptRepository.get(id);
    const videoPath = path.resolve(process.cwd(), "data", "exports", `${id}.mp4`);
    const hasVideo = existsSync(videoPath);
    const edl = await readDataSafe<Edl | null>(`edl/${id}.json`, null);
    const voiceover = await readDataSafe<VoiceoverTimeline | null>(`voiceovers/${id}/timeline.json`, null);
    const videoIsCurrent = hasVideo && Boolean(edl?.updatedAt) && statSync(videoPath).mtimeMs >= new Date(edl!.updatedAt).getTime();
    const recordedBeats = await listRecordedBeatIndices(id);
    return NextResponse.json({ brief, hasVideo, videoIsCurrent, recordedBeats, production: { edl, voiceover } });
  } catch {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
}
