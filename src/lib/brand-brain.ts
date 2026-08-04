import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const FOUNDATION_SUBDIR = "knowledge/00-foundation";
const PATTERNS_SUBDIR = "knowledge/40-patterns";
const ARTICLES_SUBDIR = "knowledge/20-articles";

async function loadBrandBrainSection(subdir: string): Promise<string | null> {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) return null;

  const sectionDir = path.join(brainPath, subdir);
  let files: string[];
  try {
    files = await readdir(sectionDir);
  } catch {
    return null;
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  if (mdFiles.length === 0) return null;

  const sections = await Promise.all(
    mdFiles.map(async (file) => readFile(path.join(sectionDir, file), "utf-8"))
  );

  return sections.join("\n\n---\n\n");
}

export async function loadBrandBrainFoundation(): Promise<string | null> {
  return loadBrandBrainSection(FOUNDATION_SUBDIR);
}

export async function loadBrandBrainReelExamples(): Promise<string | null> {
  return loadBrandBrainSection(PATTERNS_SUBDIR);
}

export async function loadBrandBrainArticle(articleSlug: string): Promise<string> {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error("BRAND_BRAIN_PATH is required to load a canonical article");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug)) {
    throw new Error(`Invalid canonical article slug: ${articleSlug}`);
  }

  const articlePath = path.join(brainPath, ARTICLES_SUBDIR, `${articleSlug}.md`);
  try {
    return await readFile(articlePath, "utf-8");
  } catch {
    throw new Error(`Canonical article not found: ${articlePath}`);
  }
}
