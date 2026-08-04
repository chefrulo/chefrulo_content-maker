import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Mutex } from "async-mutex";
import { parseIdeasFromMarkdown } from "@/lib/idea-library";
import type {
  ApproveEditorialSelection,
  ArticleReviewStatus,
  BrandBrainReviewArticle,
  BrandBrainReviewSnapshot,
  EditorialApprovalResult,
} from "@/types/brand-brain-review";

const ARTICLES_SUBDIR = "knowledge/20-articles";
const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const editorialMutex = new Mutex();
const execFileAsync = promisify(execFile);

function frontMatter(markdown: string): { values: Map<string, string>; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error("Canonical article is missing YAML front matter");
  const values = new Map<string, string>();
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (field?.[1]) values.set(field[1], field[2] ?? "");
  }
  return { values, body: markdown.slice(match[0].length).trim() };
}

function isArticleStatus(value: string | undefined): value is ArticleReviewStatus {
  return value === "draft" || value === "review" || value === "approved" || value === "published";
}

function replaceArticleStatus(markdown: string): string {
  const end = markdown.indexOf("\n---", 4);
  if (!markdown.startsWith("---\n") || end < 0) {
    throw new Error("Canonical article is missing YAML front matter");
  }
  const header = markdown.slice(0, end);
  if (!/^status:\s*\S+\s*$/m.test(header)) {
    throw new Error("Canonical article is missing status");
  }
  return `${header.replace(/^status:\s*\S+\s*$/m, "status: approved")}${markdown.slice(end)}`;
}

function replaceIdeaStatuses(markdown: string, ideaIds: Set<string>): string {
  const headingPattern = /^##\s+(idea-[a-z0-9-]+)\s+[—-]\s+.+?\s*$/gim;
  const headings = [...markdown.matchAll(headingPattern)];
  const found = new Set<string>();
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const ideaId = heading?.[1];
    if (!ideaId || heading.index === undefined || !ideaIds.has(ideaId)) continue;
    found.add(ideaId);
    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd);
    const status = /^(\*\*Status:\*\*\s*)(draft|review|approved|retired)\s*$/im.exec(block);
    if (!status || status.index === undefined) throw new Error(`Idea ${ideaId} is missing a valid status`);
    if (status[2]?.toLowerCase() === "approved") continue;
    replacements.push({
      start: blockStart + status.index,
      end: blockStart + status.index + status[0].length,
      value: `${status[1]}approved`,
    });
  }

  const missing = [...ideaIds].filter((ideaId) => !found.has(ideaId));
  if (missing.length > 0) throw new Error(`Unknown idea IDs: ${missing.join(", ")}`);

  let result = markdown;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
  }
  return result;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

export class BrandBrainEditorialService {
  constructor(private readonly configuredPath?: string) {}

  private requirePath(): string {
    const brainPath = this.configuredPath ?? process.env.BRAND_BRAIN_PATH;
    if (!brainPath) throw new Error("BRAND_BRAIN_PATH is required to review the Brand Brain");
    return path.resolve(brainPath);
  }

  private async git(args: string[]): Promise<string> {
    const result = await execFileAsync("git", ["-C", this.requirePath(), ...args]);
    return result.stdout.trim();
  }

  private async gitState(): Promise<{ revision: string; clean: boolean }> {
    const [revision, status] = await Promise.all([
      this.git(["rev-parse", "HEAD"]),
      this.git(["status", "--porcelain", "--untracked-files=all"]),
    ]);
    return { revision, clean: status.length === 0 };
  }

  async listReviews(): Promise<BrandBrainReviewSnapshot> {
    const brainPath = this.requirePath();
    const articleDir = path.join(brainPath, ARTICLES_SUBDIR);
    const files = (await readdir(articleDir)).filter((file) => file.endsWith(".md")).sort();
    const articles: BrandBrainReviewArticle[] = [];

    for (const file of files) {
      const slug = file.slice(0, -3);
      if (!SAFE_SLUG.test(slug)) continue;
      const articleMarkdown = await readFile(path.join(articleDir, file), "utf8");
      const parsed = frontMatter(articleMarkdown);
      const id = parsed.values.get("id");
      const title = parsed.values.get("title");
      const status = parsed.values.get("status");
      if (!id || !SAFE_ID.test(id)) throw new Error(`${file}: invalid or missing article id`);
      if (!title) throw new Error(`${file}: missing title`);
      if (!isArticleStatus(status)) throw new Error(`${file}: invalid or missing status`);

      let ideasMarkdown = "";
      try {
        ideasMarkdown = await readFile(path.join(brainPath, IDEA_LIBRARY_SUBDIR, file), "utf8");
      } catch {
        // An article may exist before its first ideas are proposed.
      }
      const ideas = ideasMarkdown ? parseIdeasFromMarkdown(slug, ideasMarkdown) : [];
      if (ideas.some((idea) => idea.sourceArticleId !== id)) {
        throw new Error(`${file}: idea library source article does not match ${id}`);
      }

      articles.push({
        id,
        slug,
        title,
        status,
        ...(parsed.values.get("primary_territory")
          ? { primaryTerritory: parsed.values.get("primary_territory") }
          : {}),
        body: parsed.body,
        ideas: ideas.map((idea) => ({
          id: idea.ideaId,
          title: idea.title,
          question: idea.ideaText,
          coreInsight: idea.coreInsight,
          ...(idea.whyItMatters ? { whyItMatters: idea.whyItMatters } : {}),
          status: idea.status,
          signatureIdea: idea.signatureIdea,
        })),
      });
    }

    return { ...(await this.gitState()), articles };
  }

  async approve(slug: string, selection: ApproveEditorialSelection): Promise<EditorialApprovalResult> {
    return editorialMutex.runExclusive(async () => {
      if (!SAFE_SLUG.test(slug)) throw new Error(`Invalid article slug: ${slug}`);
      if (!Array.isArray(selection.ideaIds) || selection.ideaIds.some((id) => !SAFE_ID.test(id))) {
        throw new Error("Invalid idea IDs");
      }
      const ideaIds = new Set(selection.ideaIds);
      if (!selection.approveArticle && ideaIds.size === 0) throw new Error("Nothing selected for approval");

      const state = await this.gitState();
      if (!state.clean) {
        throw new Error("Brand Brain has uncommitted changes. Resolve them before approving editorial content.");
      }

      const brainPath = this.requirePath();
      const articlePath = path.join(brainPath, ARTICLES_SUBDIR, `${slug}.md`);
      const ideasPath = path.join(brainPath, IDEA_LIBRARY_SUBDIR, `${slug}.md`);
      const originalArticle = await readFile(articlePath, "utf8");
      const originalIdeas = ideaIds.size > 0 ? await readFile(ideasPath, "utf8") : null;
      const articleData = frontMatter(originalArticle);
      const articleWasApproved = articleData.values.get("status") === "approved" || articleData.values.get("status") === "published";
      const currentIdeas = originalIdeas === null ? [] : parseIdeasFromMarkdown(slug, originalIdeas);
      const currentIdeasById = new Map(currentIdeas.map((idea) => [idea.ideaId, idea]));
      const missingIdeaIds = [...ideaIds].filter((ideaId) => !currentIdeasById.has(ideaId));
      if (missingIdeaIds.length > 0) throw new Error(`Unknown idea IDs: ${missingIdeaIds.join(", ")}`);
      const retiredIdeaIds = [...ideaIds].filter((ideaId) => currentIdeasById.get(ideaId)?.status === "retired");
      if (retiredIdeaIds.length > 0) throw new Error(`Retired ideas cannot be approved: ${retiredIdeaIds.join(", ")}`);
      const newlyApprovedIdeaIds = [...ideaIds].filter(
        (ideaId) => currentIdeasById.get(ideaId)?.status !== "approved"
      );
      const nextArticle = selection.approveArticle && !articleWasApproved
        ? replaceArticleStatus(originalArticle)
        : originalArticle;
      const nextIdeas = originalIdeas === null ? null : replaceIdeaStatuses(originalIdeas, ideaIds);
      const articleChanged = nextArticle !== originalArticle;
      const ideasChanged = nextIdeas !== null && nextIdeas !== originalIdeas;
      if (!articleChanged && !ideasChanged) throw new Error("The selected content is already approved");

      const articleRelative = path.relative(brainPath, articlePath);
      const ideasRelative = path.relative(brainPath, ideasPath);
      const changedPaths = [
        ...(articleChanged ? [articleRelative] : []),
        ...(ideasChanged ? [ideasRelative] : []),
      ];

      let committed = false;
      try {
        if (articleChanged) await atomicWrite(articlePath, nextArticle);
        if (ideasChanged && nextIdeas !== null) await atomicWrite(ideasPath, nextIdeas);
        await this.git(["diff", "--check", "--", ...changedPaths]);
        await this.git(["add", "--", ...changedPaths]);
        const parts = [
          articleChanged ? "article" : "",
          ideasChanged ? `${newlyApprovedIdeaIds.length} idea${newlyApprovedIdeaIds.length === 1 ? "" : "s"}` : "",
        ].filter(Boolean).join(" and ");
        await this.git(["commit", "-m", `editorial: approve ${slug} ${parts}`]);
        committed = true;
        const commit = await this.git(["rev-parse", "HEAD"]);
        return {
          commit,
          articleApproved: articleChanged,
          approvedIdeaIds: ideasChanged ? newlyApprovedIdeaIds : [],
        };
      } catch (error) {
        if (!committed) {
          await atomicWrite(articlePath, originalArticle);
          if (originalIdeas !== null) await atomicWrite(ideasPath, originalIdeas);
          try {
            await this.git(["restore", "--staged", "--", ...changedPaths]);
          } catch {
            // The files are restored; there may have been nothing staged yet.
          }
        }
        throw error;
      }
    });
  }
}

export const brandBrainEditorialService = new BrandBrainEditorialService();
