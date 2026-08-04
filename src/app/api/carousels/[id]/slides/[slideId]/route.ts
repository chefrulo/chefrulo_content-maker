import { NextRequest, NextResponse } from "next/server";
import { deleteSlide, updateSlide } from "@/lib/carousels";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; slideId: string }> }) {
  try {
    const { id, slideId } = await params;
    const body = await request.json() as { html?: unknown; notes?: string };
    return NextResponse.json({ slide: await updateSlide(id, slideId, body.html, body.notes) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid slide" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; slideId: string }> }) {
  try {
    const { id, slideId } = await params;
    await deleteSlide(id, slideId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Slide not found" }, { status: 404 });
  }
}
