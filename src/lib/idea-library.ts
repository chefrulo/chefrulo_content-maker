import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";

export type IdeaStatus = "draft" | "review" | "approved" | "retired";

export interface LibraryIdea {
  ideaId: string;
  title: string;
  ideaText: string;
  coreInsight: string;
  whyItMatters?: string;
  status: IdeaStatus;
  signatureIdea: boolean;
  sourceArticleId: string;
  articleSlug: string;
}

function readInlineField(block: string, label: string): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`^\\*\\*${escapedLabel}:\\*\\*\\s*(.+?)\\s*$`, "im"))?.[1]?.trim();
}

function isIdeaStatus(value: string | undefined): value is IdeaStatus {
  return value === "draft" || value === "review" || value === "approved" || value === "retired";
}

export function parseIdeasFromMarkdown(articleSlug: string, markdown: string): LibraryIdea[] {
  const ideas: LibraryIdea[] = [];
  const headingPattern = /^##\s+(idea-[a-z0-9-]+)\s+[—-]\s+(.+?)\s*$/gim;
  const headings = [...markdown.matchAll(headingPattern)];

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (!heading || heading.index === undefined) continue;
    const ideaId = heading[1]?.trim();
    const title = heading[2]?.trim();
    if (!ideaId || !title) continue;

    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd);
    const status = readInlineField(block, "Status")?.toLowerCase();
    const ideaText = readInlineField(block, "Question");
    const coreInsight = readInlineField(block, "Core insight");
    const sourceArticleId = readInlineField(block, "Source article");
    const whyItMatters = readInlineField(block, "Why it matters");
    const signatureIdea = readInlineField(block, "Signature idea")?.toLowerCase() === "yes";

    const errors: string[] = [];
    if (!isIdeaStatus(status)) errors.push("Status must be draft, review, approved or retired");
    if (!ideaText) errors.push("Question is required");
    if (!coreInsight) errors.push("Core insight is required");
    if (!sourceArticleId) errors.push("Source article is required");
    if (errors.length > 0) {
      throw new Error(`${articleSlug}.md: invalid idea ${ideaId}: ${errors.join("; ")}`);
    }

    ideas.push({
      ideaId,
      title,
      ideaText: ideaText!,
      coreInsight: coreInsight!,
      ...(whyItMatters ? { whyItMatters } : {}),
      status: status as IdeaStatus,
      signatureIdea,
      sourceArticleId: sourceArticleId!,
      articleSlug,
    });
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

export async function loadApprovedIdeas(): Promise<LibraryIdea[]> {
  return (await loadAllIdeas()).filter((idea) => idea.status === "approved");
}
