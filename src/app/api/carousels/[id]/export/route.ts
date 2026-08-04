import { NextRequest, NextResponse } from "next/server";
import { getCarousel } from "@/lib/carousels";
import { exportCarouselZip } from "@/lib/export-carousel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const carousel = await getCarousel((await params).id);
    const zip = await exportCarouselZip(carousel);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="carousel-${carousel.id}.zip"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
