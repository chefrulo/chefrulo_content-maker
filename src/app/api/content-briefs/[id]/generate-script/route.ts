import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = streamNpmScripts([{ label: "Script", args: ["generate:script", "--", id] }]);
  return sseResponse(stream);
}
