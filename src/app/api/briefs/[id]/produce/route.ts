import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = streamNpmScripts([
    { label: "Voiceover", args: ["generate:voiceover", "--", id] },
    { label: "EDL", args: ["generate:edl", "--", id] },
    { label: "Render", args: ["render:reel", "--", id] },
  ]);
  return sseResponse(stream);
}
