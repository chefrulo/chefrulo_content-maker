import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData } from "@/lib/data";
import type { ReelScript } from "@/types/reel-script";

export async function GET() {
  const dir = path.resolve(process.cwd(), "data", "reel-scripts");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }

  const briefs: ReelScript[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    briefs.push(await readData<ReelScript>(`reel-scripts/${file}`));
  }

  briefs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ briefs });
}
