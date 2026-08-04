import { NextRequest, NextResponse } from "next/server";
import { getCarousel, updateCarousel } from "@/lib/carousels";
import type { CarouselAspectRatio } from "@/types/carousel";

const RATIOS = new Set<CarouselAspectRatio>(["1:1", "4:5", "9:16"]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ carousel: await getCarousel((await params).id) });
  } catch {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json() as { aspectRatio?: CarouselAspectRatio; caption?: string; hashtags?: string[] };
    if (body.aspectRatio && !RATIOS.has(body.aspectRatio)) throw new Error("Invalid aspect ratio");
    if (body.caption !== undefined && typeof body.caption !== "string") throw new Error("Invalid caption");
    if (body.hashtags !== undefined && (!Array.isArray(body.hashtags) || !body.hashtags.every((tag) => typeof tag === "string"))) {
      throw new Error("Invalid hashtags");
    }
    return NextResponse.json({ carousel: await updateCarousel((await params).id, {
      ...(body.aspectRatio ? { aspectRatio: body.aspectRatio } : {}),
      ...(body.caption !== undefined ? { caption: body.caption.slice(0, 2200) } : {}),
      ...(body.hashtags ? { hashtags: body.hashtags.slice(0, 30) } : {}),
    }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid update" }, { status: 400 });
  }
}
