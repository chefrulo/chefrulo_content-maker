import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function GET() {
  const dir = path.resolve(process.cwd(), "data", "content-briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }

  const briefs: ContentBrief[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    briefs.push(await readData<ContentBrief>(`content-briefs/${file}`));
  }

  briefs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ briefs });
}
