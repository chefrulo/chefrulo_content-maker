import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";

export interface LibraryIdea {
  ideaId: string;
  ideaText: string;
  articleSlug: string;
}

export function computeIdeaId(articleSlug: string, ideaText: string): string {
  return createHash("sha1").update(`${articleSlug}::${ideaText}`).digest("hex").slice(0, 12);
}

function parseIdeasFromMarkdown(articleSlug: string, markdown: string): LibraryIdea[] {
  const ideas: LibraryIdea[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!match?.[1]) continue;
    const ideaText = match[1];
    ideas.push({ ideaId: computeIdeaId(articleSlug, ideaText), ideaText, articleSlug });
  }
  return ideas;
}

export async function loadAllIdeas(): Promise<LibraryIdea[]> {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) return [];

  const dir = path.join(brainPath, IDEA_LIBRARY_SUBDIR);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const all: LibraryIdea[] = [];
  for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
    const articleSlug = file.replace(/\.md$/, "");
    const markdown = await readFile(path.join(dir, file), "utf-8");
    all.push(...parseIdeasFromMarkdown(articleSlug, markdown));
  }
  return all;
}
