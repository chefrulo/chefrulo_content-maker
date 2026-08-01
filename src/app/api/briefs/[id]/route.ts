import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { readData } from "@/lib/data";
import type { ReelBrief } from "@/types/brief";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await readData<ReelBrief>(`briefs/${id}.json`);
    const hasVideo = existsSync(path.resolve(process.cwd(), "data", "exports", `${id}.mp4`));
    return NextResponse.json({ brief, hasVideo });
  } catch {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }
}
