import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { BrandBrainGateway } from "../src/lib/brand-brain.ts";

const execFileAsync = promisify(execFile);

test("gateway returns committed content and rejects a dirty Brand Brain", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "brand-brain-test-"));
  await mkdir(path.join(root, "knowledge", "00-foundation"), { recursive: true });
  await mkdir(path.join(root, "knowledge", "20-articles"), { recursive: true });
  await writeFile(path.join(root, "knowledge", "00-foundation", "manifesto.md"), "# Manifesto\n");
  await writeFile(
    path.join(root, "knowledge", "20-articles", "asado.md"),
    "---\nid: article-asado\nstatus: approved\n---\n# Asado\n"
  );
  await execFileAsync("git", ["-C", root, "init", "-b", "main"]);
  await execFileAsync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  await execFileAsync("git", ["-C", root, "config", "user.name", "Test"]);
  await execFileAsync("git", ["-C", root, "add", "."]);
  await execFileAsync("git", ["-C", root, "commit", "-m", "fixture"]);

  const gateway = new BrandBrainGateway(root);
  const context = await gateway.loadGenerationContext("asado");
  assert.match(context.revision, /^[0-9a-f]{40}$/);
  assert.match(context.canonicalArticle, /article-asado/);
  assert.match(context.foundation, /Manifesto/);
  assert.match(await gateway.loadFoundationAtRevision(context.revision), /Manifesto/);
  assert.match(await gateway.loadApprovedArticle("asado", "article-asado"), /# Asado/);

  await writeFile(path.join(root, "knowledge", "20-articles", "asado.md"), "# Changed\n");
  await assert.rejects(() => gateway.getRevision(), /uncommitted changes/);
});

test("gateway rejects articles that are not approved", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "brand-brain-test-"));
  await mkdir(path.join(root, "knowledge", "20-articles"), { recursive: true });
  await writeFile(
    path.join(root, "knowledge", "20-articles", "asado.md"),
    "---\nid: article-asado\nstatus: review\n---\n# Asado\n"
  );
  const gateway = new BrandBrainGateway(root);
  await assert.rejects(
    () => gateway.loadApprovedArticle("asado", "article-asado"),
    /approve it before generating briefs/
  );
});

test("gateway rejects unsafe article slugs", async () => {
  const gateway = new BrandBrainGateway("/tmp/unused-brand-brain-test");
  await assert.rejects(() => gateway.loadArticle("../../secret"), /Invalid canonical article slug/);
});
