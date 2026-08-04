import { NextResponse } from "next/server";
import { brandBrainEditorialService } from "@/lib/brand-brain-editorial";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await brandBrainEditorialService.listReviews());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Brand Brain review" },
      { status: 500 }
    );
  }
}
