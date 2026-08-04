import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { reelScriptRepository } from "@/repositories/operational-repository";
import { listRecordedBeatIndices } from "@/lib/beat-recording";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await reelScriptRepository.get(id);
    const hasVideo = existsSync(path.resolve(process.cwd(), "data", "exports", `${id}.mp4`));
    const recordedBeats = await listRecordedBeatIndices(id);
    return NextResponse.json({ brief, hasVideo, recordedBeats });
  } catch {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
}
