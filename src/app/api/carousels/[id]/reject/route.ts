import { NextRequest, NextResponse } from "next/server";
import { updateCarousel } from "@/lib/carousels";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ carousel: await updateCarousel((await params).id, { status: "rejected" }) });
  } catch {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }
}
