import { NextRequest, NextResponse } from "next/server";
import { validateRequestedIdeaIds } from "@/lib/brief-idea-selection";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin generation is not allowed" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const ideaIds = validateRequestedIdeaIds((body as { ideaIds?: unknown } | null)?.ideaIds);
    const args = ["generate:briefs", "--", ...ideaIds.map((ideaId) => `--idea=${ideaId}`)];
    return sseResponse(streamNpmScripts([{ label: "Briefs", args }]));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid idea selection" },
      { status: 400 }
    );
  }
}
