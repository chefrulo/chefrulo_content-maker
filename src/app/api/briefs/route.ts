import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData } from "@/lib/data";
import type { ReelBrief } from "@/types/brief";

export async function GET() {
  const dir = path.resolve(process.cwd(), "data", "briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }

  const briefs: ReelBrief[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    briefs.push(await readData<ReelBrief>(`briefs/${file}`));
  }

  briefs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ briefs });
}
