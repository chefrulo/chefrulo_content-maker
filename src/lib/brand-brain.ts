import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const FOUNDATION_SUBDIR = "knowledge/00-foundation";

export async function loadBrandBrainFoundation(): Promise<string | null> {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) return null;

  const foundationDir = path.join(brainPath, FOUNDATION_SUBDIR);
  let files: string[];
  try {
    files = await readdir(foundationDir);
  } catch {
    return null;
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  if (mdFiles.length === 0) return null;

  const sections = await Promise.all(
    mdFiles.map(async (file) => readFile(path.join(foundationDir, file), "utf-8"))
  );

  return sections.join("\n\n---\n\n");
}
