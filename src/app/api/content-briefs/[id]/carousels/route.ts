import { NextRequest, NextResponse } from "next/server";
import { createCarouselFromBrief, listCarouselsForBrief } from "@/lib/carousels";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ carousels: await listCarouselsForBrief(id) });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ carousel: await createCarouselFromBrief(id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create carousel" }, { status: 400 });
  }
}
