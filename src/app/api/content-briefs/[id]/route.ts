import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ error: "Content brief not found" }, { status: 404 });
  }
}
