import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { BrandBrainEditorialService } from "../src/lib/brand-brain-editorial.ts";

const execFileAsync = promisify(execFile);
const articleFixture = `---
id: article-asado
title: What an Argentine asado really is
status: review
primary_territory: argentine-table-culture
---

# What an Argentine asado really is

An asado is a gathering built around the fire.
`;
const ideasFixture = `---
article_id: article-asado
article_slug: asado
---

# Asado Idea Library

## idea-asado-001 — The fire is the first guest

**Status:** review
**Signature idea:** yes
**Question:** Why does an asado begin before anyone eats?
**Core insight:** Lighting the fire begins the gathering.
**Source article:** article-asado

## idea-asado-002 — An asado is more than barbecue

**Status:** review
**Signature idea:** no
**Question:** Why is asado more than barbecue?
**Core insight:** The word also names the social ritual.
**Source article:** article-asado
`;

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "brand-brain-editorial-test-"));
  const articleDir = path.join(root, "knowledge", "20-articles");
  const ideaDir = path.join(root, "knowledge", "15-idea-library");
  await mkdir(articleDir, { recursive: true });
  await mkdir(ideaDir, { recursive: true });
  await writeFile(path.join(articleDir, "asado.md"), articleFixture);
  await writeFile(path.join(ideaDir, "asado.md"), ideasFixture);
  await execFileAsync("git", ["-C", root, "init", "-b", "main"]);
  await execFileAsync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  await execFileAsync("git", ["-C", root, "config", "user.name", "Test"]);
  await execFileAsync("git", ["-C", root, "add", "."]);
  await execFileAsync("git", ["-C", root, "commit", "-m", "fixture"]);
  return root;
}

test("review snapshot exposes canonical articles and their idea libraries", async () => {
  const root = await createFixture();
  const snapshot = await new BrandBrainEditorialService(root).listReviews();

  assert.equal(snapshot.clean, true);
  assert.match(snapshot.revision, /^[0-9a-f]{40}$/);
  assert.equal(snapshot.articles[0]?.id, "article-asado");
  assert.equal(snapshot.articles[0]?.status, "review");
  assert.equal(snapshot.articles[0]?.ideas.length, 2);
});

test("one approval atomically updates article and selected ideas and creates a commit", async () => {
  const root = await createFixture();
  const service = new BrandBrainEditorialService(root);
  const result = await service.approve("asado", {
    approveArticle: true,
    ideaIds: ["idea-asado-001"],
  });

  assert.match(result.commit, /^[0-9a-f]{40}$/);
  assert.equal(result.articleApproved, true);
  assert.deepEqual(result.approvedIdeaIds, ["idea-asado-001"]);

  const article = await readFile(path.join(root, "knowledge", "20-articles", "asado.md"), "utf8");
  const ideas = await readFile(path.join(root, "knowledge", "15-idea-library", "asado.md"), "utf8");
  assert.match(article, /^status: approved$/m);
  assert.match(ideas, /idea-asado-001[\s\S]*?\*\*Status:\*\* approved/);
  assert.match(ideas, /idea-asado-002[\s\S]*?\*\*Status:\*\* review/);

  const status = await execFileAsync("git", ["-C", root, "status", "--porcelain"]);
  const subject = await execFileAsync("git", ["-C", root, "log", "-1", "--pretty=%s"]);
  assert.equal(status.stdout, "");
  assert.equal(subject.stdout.trim(), "editorial: approve asado article and 1 idea");
});

test("approval refuses a dirty Brand Brain without changing editorial files", async () => {
  const root = await createFixture();
  const articlePath = path.join(root, "knowledge", "20-articles", "asado.md");
  await writeFile(path.join(root, "notes.md"), "uncommitted\n");

  await assert.rejects(
    () => new BrandBrainEditorialService(root).approve("asado", { approveArticle: true, ideaIds: [] }),
    /uncommitted changes/
  );
  assert.equal(await readFile(articlePath, "utf8"), articleFixture);
});

test("failed Git commit restores both files and the index", async () => {
  const root = await createFixture();
  const hookPath = path.join(root, ".git", "hooks", "pre-commit");
  await writeFile(hookPath, "#!/bin/sh\nexit 1\n");
  await chmod(hookPath, 0o755);

  await assert.rejects(
    () => new BrandBrainEditorialService(root).approve("asado", {
      approveArticle: true,
      ideaIds: ["idea-asado-001"],
    })
  );

  assert.equal(
    await readFile(path.join(root, "knowledge", "20-articles", "asado.md"), "utf8"),
    articleFixture
  );
  assert.equal(
    await readFile(path.join(root, "knowledge", "15-idea-library", "asado.md"), "utf8"),
    ideasFixture
  );
  const status = await execFileAsync("git", ["-C", root, "status", "--porcelain"]);
  assert.equal(status.stdout, "");
});
