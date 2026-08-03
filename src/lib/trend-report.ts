import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadLatestTrendReport(): Promise<string | null> {
  const dir = path.resolve(process.cwd(), "data", "trend-reports");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const latest = jsonFiles.at(-1);
  if (!latest) return null;

  return readFile(path.join(dir, latest), "utf-8");
}
