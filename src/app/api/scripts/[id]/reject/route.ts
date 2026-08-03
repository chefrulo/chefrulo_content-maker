import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import type { ReelScript } from "@/types/reel-script";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await readData<ReelScript>(`reel-scripts/${id}.json`);
  brief.status = "rejected";
  await writeData(`reel-scripts/${id}.json`, brief);
  return NextResponse.json({ brief });
}
