import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) {
    return new Response(JSON.stringify({ error: "Confirmation required" }), { status: 400 });
  }

  const stream = streamNpmScripts([
    { label: "Publish", args: ["publish:reel", "--", id, "--yes"] },
  ]);
  return sseResponse(stream);
}
