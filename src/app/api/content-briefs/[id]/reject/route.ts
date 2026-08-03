import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  brief.status = "rejected";
  await writeData(`content-briefs/${id}.json`, brief);
  return NextResponse.json({ brief });
}
