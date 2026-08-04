import { NextRequest, NextResponse } from "next/server";
import { addSlide, reorderSlides } from "@/lib/carousels";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json() as { html?: unknown; notes?: string };
    return NextResponse.json({ slide: await addSlide((await params).id, body.html, body.notes) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid slide" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json() as { slideIds?: unknown };
    return NextResponse.json({ slides: await reorderSlides((await params).id, body.slideIds) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid slide order" }, { status: 400 });
  }
}
