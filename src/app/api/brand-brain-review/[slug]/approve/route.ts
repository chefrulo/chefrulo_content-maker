import { NextRequest, NextResponse } from "next/server";
import { brandBrainEditorialService } from "@/lib/brand-brain-editorial";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin editorial changes are not allowed" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { approveArticle?: unknown }).approveArticle !== "boolean" ||
    !Array.isArray((body as { ideaIds?: unknown }).ideaIds)
  ) {
    return NextResponse.json({ error: "approveArticle and ideaIds are required" }, { status: 400 });
  }

  try {
    const { slug } = await params;
    const selection = body as { approveArticle: boolean; ideaIds: unknown[] };
    if (!selection.ideaIds.every((id): id is string => typeof id === "string")) {
      return NextResponse.json({ error: "ideaIds must contain only strings" }, { status: 400 });
    }
    return NextResponse.json(
      await brandBrainEditorialService.approve(slug, {
        approveArticle: selection.approveArticle,
        ideaIds: selection.ideaIds,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Editorial approval failed";
    const conflict = /uncommitted changes|already approved/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
  }
}
