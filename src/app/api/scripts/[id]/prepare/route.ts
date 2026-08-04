import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return sseResponse(streamNpmScripts([
    { label: "Voz y tiempos reales", args: ["generate:voiceover", "--", id] },
    { label: "Selección de footage", args: ["generate:edl", "--", id] },
  ]));
}
