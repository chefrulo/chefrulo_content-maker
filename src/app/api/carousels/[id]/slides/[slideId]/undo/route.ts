import { NextRequest, NextResponse } from "next/server";
import { undoSlide } from "@/lib/carousels";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; slideId: string }> }) {
  try {
    const { id, slideId } = await params;
    return NextResponse.json({ slide: await undoSlide(id, slideId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No previous version" }, { status: 409 });
  }
}
