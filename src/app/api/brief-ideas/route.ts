import { NextResponse } from "next/server";
import {
  loadAvailableBriefIdeas,
  MAX_BRIEF_IDEA_SELECTION,
} from "@/lib/brief-idea-selection";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ideas = await loadAvailableBriefIdeas();
    return NextResponse.json({
      ideas,
      maxSelection: MAX_BRIEF_IDEA_SELECTION,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las ideas" },
      { status: 500 }
    );
  }
}
