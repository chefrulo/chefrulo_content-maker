import { NextRequest, NextResponse } from "next/server";
import { getCarousel, updateCarousel } from "@/lib/carousels";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const carousel = await getCarousel(id);
    if (carousel.slides.length === 0) return NextResponse.json({ error: "A carousel without slides cannot be approved" }, { status: 409 });
    return NextResponse.json({ carousel: await updateCarousel(id, { status: "approved" }) });
  } catch {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }
}
