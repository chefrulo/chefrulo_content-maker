import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST() {
  const stream = streamNpmScripts([
    { label: "Research", args: ["scrape:inspiration"] },
    { label: "Briefs", args: ["generate:briefs"] },
  ]);
  return sseResponse(stream);
}
