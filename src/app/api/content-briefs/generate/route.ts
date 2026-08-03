import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest) {
  const stream = streamNpmScripts([{ label: "Briefs", args: ["generate:briefs"] }]);
  return sseResponse(stream);
}
