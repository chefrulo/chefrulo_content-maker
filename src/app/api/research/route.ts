import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST() {
  const stream = streamNpmScripts([
    { label: "Scrape", args: ["scrape:inspiration"] },
    { label: "Trend report", args: ["generate:trend-report"] },
  ]);
  return sseResponse(stream);
}
