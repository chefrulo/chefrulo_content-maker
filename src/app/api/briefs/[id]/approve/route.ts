import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import type { ReelBrief } from "@/types/brief";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await readData<ReelBrief>(`briefs/${id}.json`);
  brief.status = "approved";
  await writeData(`briefs/${id}.json`, brief);
  return NextResponse.json({ brief });
}
