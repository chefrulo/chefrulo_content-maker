import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const FOUNDATION_SUBDIR = "knowledge/00-foundation";
const PATTERNS_SUBDIR = "knowledge/40-patterns";
const ARTICLES_SUBDIR = "knowledge/20-articles";
const execFileAsync = promisify(execFile);

function frontMatterValue(markdown: string, field: string): string | undefined {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`^${escapedField}:\\s*(\\S.*?)\\s*$`, "m"))?.[1]?.trim();
}

export interface BrandBrainGenerationContext {
  revision: string;
  foundation: string;
  reelExamples: string | null;
  canonicalArticle: string;
}

export class BrandBrainGateway {
  constructor(private readonly configuredPath?: string) {}

  private requirePath(): string {
    const brainPath = this.configuredPath ?? process.env.BRAND_BRAIN_PATH;
    if (!brainPath) {
      throw new Error("BRAND_BRAIN_PATH is required to read the Brand Brain");
    }
    return path.resolve(brainPath);
  }

  private async loadSection(subdir: string): Promise<string | null> {
    const brainPath = this.requirePath();

    const sectionDir = path.join(brainPath, subdir);
    let files: string[];
    try {
      files = await readdir(sectionDir);
    } catch {
      return null;
    }

    const mdFiles = files.filter((file) => file.endsWith(".md")).sort();
    if (mdFiles.length === 0) return null;

    const sections = await Promise.all(
      mdFiles.map(async (file) => readFile(path.join(sectionDir, file), "utf-8"))
    );

    return sections.join("\n\n---\n\n");
  }

  async loadFoundation(): Promise<string> {
    const foundation = await this.loadSection(FOUNDATION_SUBDIR);
    if (!foundation) {
      throw new Error(`Brand Brain foundation is empty: ${path.join(this.requirePath(), FOUNDATION_SUBDIR)}`);
    }
    return foundation;
  }

  async loadReelExamples(): Promise<string | null> {
    return this.loadSection(PATTERNS_SUBDIR);
  }

  async loadArticle(articleSlug: string): Promise<string> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug)) {
      throw new Error(`Invalid canonical article slug: ${articleSlug}`);
    }

    const articlePath = path.join(this.requirePath(), ARTICLES_SUBDIR, `${articleSlug}.md`);
    try {
      return await readFile(articlePath, "utf-8");
    } catch {
      throw new Error(`Canonical article not found: ${articlePath}`);
    }
  }

  async loadApprovedArticle(articleSlug: string, expectedArticleId?: string): Promise<string> {
    const article = await this.loadArticle(articleSlug);
    const articleId = frontMatterValue(article, "id");
    const status = frontMatterValue(article, "status");
    if (!articleId) throw new Error(`Canonical article ${articleSlug} has no stable id`);
    if (expectedArticleId && articleId !== expectedArticleId) {
      throw new Error(
        `Idea source article mismatch: expected ${expectedArticleId}, found ${articleId}`
      );
    }
    if (status !== "approved" && status !== "published") {
      throw new Error(
        `Canonical article ${articleId} is ${status ?? "missing a status"}; approve it before generating briefs`
      );
    }
    return article;
  }

  async loadFoundationAtRevision(revision: string): Promise<string> {
    if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("Invalid Brand Brain revision");
    const brainPath = this.requirePath();
    const tree = await execFileAsync("git", [
      "-C", brainPath, "ls-tree", "-r", "--name-only", revision, "--", FOUNDATION_SUBDIR,
    ]);
    const files = tree.stdout.split(/\r?\n/).filter((file) => file.endsWith(".md")).sort();
    if (files.length === 0) throw new Error(`Brand Brain foundation is empty at ${revision}`);
    const sections = await Promise.all(files.map(async (file) => {
      const result = await execFileAsync("git", ["-C", brainPath, "show", `${revision}:${file}`]);
      return result.stdout;
    }));
    return sections.join("\n\n---\n\n");
  }

  async getRevision(): Promise<string> {
    const brainPath = this.requirePath();
    let revision: string;
    let workingTree: string;
    try {
      const [revisionResult, statusResult] = await Promise.all([
        execFileAsync("git", ["-C", brainPath, "rev-parse", "HEAD"]),
        execFileAsync("git", ["-C", brainPath, "status", "--porcelain", "--untracked-files=all"]),
      ]);
      revision = revisionResult.stdout.trim();
      workingTree = statusResult.stdout.trim();
    } catch (error) {
      throw new Error(
        `Could not resolve Brand Brain Git revision: ${error instanceof Error ? error.message : error}`
      );
    }

    if (!revision) {
      throw new Error("Brand Brain Git revision is empty");
    }
    if (workingTree) {
      throw new Error(
        "Brand Brain has uncommitted changes. Commit or discard them before generating editorial derivatives so provenance remains reproducible."
      );
    }
    return revision;
  }

  async loadGenerationContext(articleSlug: string): Promise<BrandBrainGenerationContext> {
    const [revision, foundation, reelExamples, canonicalArticle] = await Promise.all([
      this.getRevision(),
      this.loadFoundation(),
      this.loadReelExamples(),
      this.loadArticle(articleSlug),
    ]);
    return { revision, foundation, reelExamples, canonicalArticle };
  }
}

export const brandBrainGateway = new BrandBrainGateway();

export async function loadBrandBrainFoundation(): Promise<string | null> {
  return brandBrainGateway.loadFoundation();
}

export async function loadBrandBrainReelExamples(): Promise<string | null> {
  return brandBrainGateway.loadReelExamples();
}

export async function loadBrandBrainArticle(articleSlug: string): Promise<string> {
  return brandBrainGateway.loadArticle(articleSlug);
}
