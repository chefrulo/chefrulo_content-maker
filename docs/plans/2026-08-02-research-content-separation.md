# Research/Content Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the pipeline into an independent Research Intelligence engine (market data only, never generates content) and an Editorial Content Engine that always starts from the Brand Brain — with a new permanent Idea Library layer and a new abstract, independently-reviewable `ContentBrief` stage before the existing beat-level script.

**Architecture:** New `ContentBrief` type (abstract: hook/coreMessage/culturalInsight/personalStory/educationalValue/cta) sits between a permanent Idea Library (markdown, lives in the Brand Brain repo) and the renamed `ReelScript` (today's `ReelBrief`, unchanged shape, gets a `contentBriefId` back-reference). Research produces `data/trend-reports/` snapshots that only ever inform *presentation* at script-generation time, never topic. Full design rationale: `docs/decisions/2026-08-02-separate-research-from-content-creation.md` and `docs/plans/2026-08-02-research-content-separation-design.md`.

**Tech Stack:** Next.js 16 (App Router) API routes, `tsx` CLI scripts, Claude CLI via `runClaudeAgent`, filesystem-as-database (`data/*.json`, gitignored) via `src/lib/data.ts`, Brand Brain as a separate local repo read via `BRAND_BRAIN_PATH`.

**Testing note:** This project has no test runner configured (no `test` script, no test files exist anywhere in the repo — confirmed by search). Do not add one as a side effect of this plan. "Test" steps below are manual verification: `npx tsc --noEmit -p .` for type safety, and small throwaway `node --experimental-strip-types -e '...'` snippets (same pattern already used earlier in this project's history) to sanity-check pure functions before wiring them into scripts. Steps that would spend real money (a live Claude CLI call, e.g. `generate:ideas`, `generate:briefs`, `generate:trend-report`, `generate:script`) are marked **[COSTS MONEY — run only when ready]** and are not required to consider a task done; `tsc` passing is.

---

### Task 1: `ContentBrief` type

**Files:**
- Create: `src/types/content-brief.ts`

**Step 1: Write the type**

```ts
export interface ContentBrief {
  id: string;
  ideaId: string;
  ideaText: string;
  brandPillar: string;
  editorialTerritory: string;
  hook: string;
  coreMessage: string;
  culturalInsight: string;
  personalStory?: string;
  educationalValue: string;
  cta: string;
  status: "pending_review" | "approved" | "rejected";
  createdAt: string;
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors (this file isn't imported anywhere yet, so it just needs to parse).

**Step 3: Commit**

```bash
git add src/types/content-brief.ts
git commit -m "feat: add ContentBrief type"
```

---

### Task 2: Rename `ReelBrief` → `ReelScript`

**Files:**
- Create: `src/types/reel-script.ts` (copy of `src/types/brief.ts` with the rename)
- Delete: `src/types/brief.ts`
- Modify (import path `@/types/brief` → `@/types/reel-script`, and `ReelBrief` → `ReelScript` as a type name only — keep variable names like `brief` as-is where they still make sense contextually, this is a type rename not a full vocabulary rewrite of every local variable):
  - `src/scripts/generate-briefs.ts` (will be rewritten in Task 8 anyway — skip touching it here)
  - `src/scripts/approve-brief.ts` (will be split in Task 11 — skip here)
  - `src/scripts/generate-voiceover.ts`
  - `src/scripts/generate-edl.ts`
  - `src/scripts/render-reel.ts`
  - `src/scripts/publish-reel.ts` (check it imports the type — grep first)
  - `src/components/BriefCard.tsx` (renamed in Task 15 — skip here)
  - `src/app/briefs/[id]/page.tsx` (renamed in Task 16 — skip here)
  - `src/app/api/briefs/route.ts`, `src/app/api/briefs/[id]/route.ts`, `src/app/api/briefs/[id]/approve/route.ts`, `src/app/api/briefs/[id]/reject/route.ts`, `src/app/api/briefs/[id]/produce/route.ts`, `src/app/api/briefs/[id]/publish/route.ts` (renamed in Task 14 — skip here)

**Step 1: Create the new type file**

```ts
export interface ReelBeat {
  visual: string;
  onScreenText?: string;
  voiceover?: string;
  estimatedSeconds: number;
}

export interface ReelScript {
  id: string;
  createdAt: string;
  contentBriefId: string;
  brandPillar: string;
  editorialTerritory: string;
  topic: string;
  contentPattern: string;
  hook: string;
  beats: ReelBeat[];
  cta: string;
  estimatedDurationSeconds: number;
  inspiredBy: string[];
  status: "pending_review" | "approved" | "rejected" | "published";
  publishedAt?: string;
  publishedMediaId?: string;
  publishedVideoUrl?: string;
}
```

**Step 2: Delete the old file**

```bash
rm src/types/brief.ts
```

**Step 3: Update the scripts not touched by later tasks**

In `src/scripts/generate-voiceover.ts`, `src/scripts/generate-edl.ts`, `src/scripts/render-reel.ts`:
replace `import type { ReelBrief } from "../types/brief.js";` with
`import type { ReelScript } from "../types/reel-script.js";`, and replace every
use of the `ReelBrief` type annotation with `ReelScript` (the local variable
name `brief` can stay — only the type name changes). Also check
`src/scripts/publish-reel.ts` with `grep -n "ReelBrief\|types/brief" src/scripts/publish-reel.ts`
and apply the same substitution if it matches.

**Step 4: Verify nothing else references the old path**

Run: `grep -rn "types/brief\b" src --include="*.ts" --include="*.tsx"`
Expected output: only the files listed in Task 11, 14, 15, 16 (which get fixed in
their own tasks) plus none from Step 3 above. If `tsc` (next step) passes for
everything except those known-pending files, that's correct for this task.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename ReelBrief type to ReelScript"
```

(This commit will leave `tsc` red until Tasks 11/14/15/16 land — that's expected
mid-refactor. Don't run the full-project `tsc` gate until Task 19.)

---

### Task 3: Idea Library reader (`src/lib/idea-library.ts`)

Ideas live as markdown bullet lists in the Brand Brain repo, one file per
article, e.g.:

```markdown
# Idea Library: Asado

- Why does an asado last five hours if the meat cooks much faster?
- Why is choripán served before the meat?
```

**Files:**
- Create: `src/lib/idea-library.ts`

**Step 1: Write the implementation**

```ts
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
```

**Step 2: Sanity-check the hashing and parsing manually**

Run:
```bash
node --experimental-strip-types -e '
import("./src/lib/idea-library.ts").then((m) => {
  const md = "# Idea Library: Asado\n\n- Why does an asado last five hours?\n- Why is choripán served first?\n";
  const ideas = md.split("\n").filter(l => l.trim());
  console.log(m.computeIdeaId("asado", "Why does an asado last five hours?"));
  console.log(m.computeIdeaId("asado", "Why does an asado last five hours?")); // must match line above
  console.log(m.computeIdeaId("asado", "Why is choripán served first?")); // must differ
});
'
```
Expected: two identical 12-char hex strings on the first two lines, a different one on the third.

**Step 3: Commit**

```bash
git add src/lib/idea-library.ts
git commit -m "feat: add idea library reader for Brand Brain knowledge/15-idea-library"
```

---

### Task 4: Trend report reader (`src/lib/trend-report.ts`)

**Files:**
- Create: `src/lib/trend-report.ts`

**Step 1: Write the implementation**

```ts
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
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/trend-report.ts
git commit -m "feat: add trend report reader"
```

---

### Task 5: `generate-trend-report.ts` script

**Files:**
- Create: `src/scripts/generate-trend-report.ts`
- Modify: `package.json` (add script)

**Step 1: Write the script**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { InspirationScrapeResult } from "../types/inspiration.js";

async function loadAllReels() {
  const dir = path.resolve(process.cwd(), "data", "inspiration-reels");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const all: Array<{ handle: string; caption: string; likesCount: number; commentsCount: number; videoDuration: number | null }> = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const result = await readDataSafe<InspirationScrapeResult | null>(`inspiration-reels/${file}`, null);
    if (!result) continue;
    for (const reel of result.reels) {
      all.push({
        handle: result.handle,
        caption: reel.caption,
        likesCount: reel.likesCount,
        commentsCount: reel.commentsCount,
        videoDuration: reel.videoDuration,
      });
    }
  }
  return all;
}

function buildPrompt(reels: Awaited<ReturnType<typeof loadAllReels>>): string {
  const block = reels
    .map((r) => `- @${r.handle} (${r.likesCount} likes, ${r.commentsCount} comments${r.videoDuration ? `, ${r.videoDuration}s` : ""}): "${r.caption.slice(0, 200).replace(/\n/g, " ")}"`)
    .join("\n");

  return `You are a social media market analyst. Below are recent reels from Argentine food / asado / pop-up culture creators on Instagram — NOT the brand you work for, just market data to analyze.

${block}

## Task
Analyze ONLY what's happening in this content — you are not generating any content ideas, topics, scripts, or anything attributed to any specific brand. This is pure market intelligence for humans to read.

Respond with ONLY a raw JSON object (no markdown fences, no prose before or after), with this shape:
{
  "topHookPatterns": ["<short description of a hook style that recurs, with an example>", ...],
  "avgDurationSeconds": <number, estimated from the data available>,
  "ctaPatterns": ["<recurring CTA style>", ...],
  "emotionalPatterns": ["<recurring emotional tone or angle>", ...],
  "postingFrequencyNotes": "<brief note on cadence if inferable, else 'not enough data'>",
  "saturatedTopics": ["<topic that appears repeatedly across creators>", ...],
  "emergingOpportunities": ["<a gap or underused angle observed>", ...]
}`;
}

async function main() {
  const reels = await loadAllReels();
  if (reels.length === 0) {
    console.log("No hay reels en data/inspiration-reels/. Corré `npm run scrape:inspiration` primero.");
    return;
  }

  console.log(`Analizando ${reels.length} reels para el trend report...`);
  const prompt = buildPrompt(reels);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-trend-report" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const parsed = JSON.parse(text);

  const date = new Date().toISOString().slice(0, 10);
  const report = { generatedAt: new Date().toISOString(), reelsAnalyzed: reels.length, ...parsed };
  await writeData(`trend-reports/${date}.json`, report);
  console.log(`Trend report guardado en data/trend-reports/${date}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 2: Add the npm script**

In `package.json`, add after `"scrape:inspiration"`:
```json
"generate:trend-report": "tsx src/scripts/generate-trend-report.ts",
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 4 [COSTS MONEY — run only when ready]:**

Run: `npm run generate:trend-report`
Expected (if `data/inspiration-reels/` has data from a prior `scrape:inspiration` run): a new `data/trend-reports/<date>.json` file with the shape above.

**Step 5: Commit**

```bash
git add src/scripts/generate-trend-report.ts package.json
git commit -m "feat: add generate:trend-report script"
```

---

### Task 6: Trim `pipeline-research.ts`

**Files:**
- Modify: `src/scripts/pipeline-research.ts`

**Step 1: Replace the file contents**

```ts
import { spawnSync } from "node:child_process";

function runStep(label: string, npmScript: string): void {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("npm", ["run", npmScript], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n"${label}" falló (exit ${result.status}). Frenando el pipeline.`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  runStep("1/2 — Scrapeando cuentas de inspiración", "scrape:inspiration");
  runStep("2/2 — Generando trend report", "generate:trend-report");

  console.log(`\n=== Research Intelligence: listo ===`);
  console.log(`Reporte de tendencias guardado en data/trend-reports/. Este motor nunca genera contenido de Chef Rulo — solo inteligencia de mercado para vos.`);
  console.log(`Para generar ideas y briefs editoriales, usá \`npm run generate:ideas -- <slug-articulo>\` y después \`npm run generate:briefs\`.`);
}

main();
```

Note this drops the `ReelBrief`/checkpoint-listing logic entirely — this
script no longer touches briefs at all, per the architecture split.

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/scripts/pipeline-research.ts
git commit -m "refactor: trim pipeline:research to scrape + trend report only"
```

---

### Task 7: `generate-ideas.ts` script

**Files:**
- Create: `src/scripts/generate-ideas.ts`
- Modify: `package.json`

**Step 1: Write the script**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runClaudeAgent } from "../lib/claude-agent.js";
import { loadBrandBrainFoundation } from "../lib/brand-brain.js";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";
const ARTICLES_SUBDIR = "knowledge/20-articles";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("Uso: npm run generate:ideas -- <slug-articulo>");
    console.log("El slug corresponde a un archivo en knowledge/20-articles/<slug>.md del Brand Brain.");
    return;
  }

  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error("BRAND_BRAIN_PATH no está seteado en .env.local — es obligatorio para generar ideas.");
  }

  const articlePath = path.join(brainPath, ARTICLES_SUBDIR, `${slug}.md`);
  let article: string;
  try {
    article = await readFile(articlePath, "utf-8");
  } catch {
    throw new Error(`No se encontró ${articlePath}. Creá el artículo canónico primero.`);
  }

  const foundation = await loadBrandBrainFoundation();
  const libraryDir = path.join(brainPath, IDEA_LIBRARY_SUBDIR);
  await mkdir(libraryDir, { recursive: true });
  const libraryPath = path.join(libraryDir, `${slug}.md`);
  let existing = "";
  try {
    existing = await readFile(libraryPath, "utf-8");
  } catch {
    // file doesn't exist yet, that's fine
  }
  const existingIdeas = new Set(
    existing
      .split("\n")
      .map((l) => l.match(/^\s*-\s+(.+?)\s*$/)?.[1])
      .filter((x): x is string => Boolean(x))
  );

  const prompt = `${foundation ? `## Brand Brain\n${foundation}\n\n---\n\n` : ""}## Canonical article
${article}

## Task
Generate 8 to 12 concrete, curious reel-idea questions grounded ONLY in this article — the kind that make someone want to know the answer. Match the style of these already-approved ideas (short questions, specific, never generic):

- Why does an asado last five hours if the meat cooks much faster?
- Why is choripán served before the meat?
- What does the asador actually do?

Do not write hooks, scripts or answers — just the questions. Respond with ONLY a raw JSON array of strings, no markdown fences, no prose.`;

  console.log(`Generando ideas para "${slug}"...`);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-idea-generator" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const ideas: string[] = JSON.parse(text);

  const newIdeas = ideas.filter((idea) => !existingIdeas.has(idea));
  if (newIdeas.length === 0) {
    console.log("Todas las ideas generadas ya estaban en la librería. Nada nuevo para agregar.");
    return;
  }

  const header = existing.trim().length > 0 ? "" : `# Idea Library: ${slug}\n\n`;
  const appendix = newIdeas.map((idea) => `- ${idea}`).join("\n") + "\n";
  await writeFile(libraryPath, existing + (existing.trim().length > 0 ? "\n" : header) + appendix, "utf-8");

  console.log(`\n${newIdeas.length} ideas nuevas agregadas a ${path.relative(brainPath, libraryPath)}:\n`);
  for (const idea of newIdeas) console.log(`  - ${idea}`);
  console.log(`\nRevisá y editá el archivo a mano si querés antes de correr generate:briefs.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 2: Add the npm script**

In `package.json`:
```json
"generate:ideas": "tsx src/scripts/generate-ideas.ts",
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 4 [COSTS MONEY — run only when ready]:**

Run: `npm run generate:ideas -- asado` (assuming `knowledge/20-articles/asado.md` exists in
the Brand Brain repo — if it doesn't exist yet, create a short canonical article there first,
this script requires it).
Expected: new ideas printed to console and appended to
`chef-rulo-brand-brain/knowledge/15-idea-library/asado.md`.

**Step 5: Commit**

```bash
git add src/scripts/generate-ideas.ts package.json
git commit -m "feat: add generate:ideas script (article -> Idea Library)"
```

---

### Task 8: Rewrite `generate-briefs.ts` (Idea → `ContentBrief`)

**Files:**
- Modify: `src/scripts/generate-briefs.ts` (full rewrite)

**Step 1: Replace the file contents**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { loadBrandBrainFoundation, loadBrandBrainReelExamples } from "../lib/brand-brain.js";
import { loadAllIdeas } from "../lib/idea-library.js";
import { readDataSafe, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";

const BRIEFS_PER_RUN = 5;

async function loadUsedIdeaIds(): Promise<Set<string>> {
  const dir = path.resolve(process.cwd(), "data", "content-briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return new Set();
  }

  const used = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readDataSafe<ContentBrief | null>(`content-briefs/${file}`, null);
    if (brief) used.add(brief.ideaId);
  }
  return used;
}

function buildPrompt(
  brand: Awaited<ReturnType<typeof getBrand>>,
  ideaText: string,
  brandPillar: string,
  brandBrain: string | null,
  reelExamples: string | null
): string {
  const brandBrainBlock = brandBrain
    ? `## Editorial foundation — non-negotiable, overrides everything below if they ever conflict
${brandBrain}

---
`
    : "";

  const reelExamplesBlock = reelExamples
    ? `## Gold-standard reel examples — reference for tone and cultural insight, not for topic
${reelExamples}

---
`
    : "";

  return `You are the editorial lead for "${brand.name}". You develop ONE approved idea into a Content Brief — an abstract editorial piece, not a shot-by-shot script yet.

${brandBrainBlock}${reelExamplesBlock}## Brand
- Positioning: ${brand.positioning}
- Tone: ${brand.toneKeywords.join(", ")}
- Target audience: ${brand.targetAudience}

## The idea to develop
"${ideaText}"

## Brand pillar for this piece
${brandPillar}

## Task
Develop this idea into a Content Brief. Do NOT write beats, shots, or a script — this is the abstract editorial layer that comes before that. Ground every claim in the brand brain above; never invent a personal story — omit personalStory entirely if none is documented.

Respond with ONLY a raw JSON object (no markdown fences, no prose), with this shape:
{
  "editorialTerritory": "<concrete subject-matter territory this idea belongs to>",
  "hook": "<the core attention-grabbing framing, under 12 words>",
  "coreMessage": "<the one thing this piece needs to communicate, 1-2 sentences>",
  "culturalInsight": "<the specific cultural insight or nuance this piece reveals, 1-2 sentences>",
  "personalStory": "<omit this field entirely unless grounded in a real, documented story from the brand brain>",
  "educationalValue": "<what the audience walks away understanding, 1 sentence>",
  "cta": "<a natural closing question or invitation>"
}`;
}

async function main() {
  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error(
      "BRAND_BRAIN_PATH no está seteado en .env.local — es obligatorio para generar briefs. Sin el Brand Brain no hay de dónde sacar la voz editorial."
    );
  }

  const brand = await getBrand();
  const allIdeas = await loadAllIdeas();
  if (allIdeas.length === 0) {
    console.log(
      "No hay ideas en knowledge/15-idea-library/ del Brand Brain. Corré `npm run generate:ideas -- <slug-articulo>` primero."
    );
    return;
  }

  const usedIdeaIds = await loadUsedIdeaIds();
  const unusedIdeas = allIdeas.filter((idea) => !usedIdeaIds.has(idea.ideaId));
  if (unusedIdeas.length === 0) {
    console.log("Todas las ideas de la librería ya tienen un Content Brief. Agregá más ideas con `npm run generate:ideas`.");
    return;
  }

  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();
  const pillarNames = brand.pillars.map((p) => p.name);
  const selected = unusedIdeas.slice(0, BRIEFS_PER_RUN);

  console.log(`Generando ${selected.length} briefs desde la Idea Library (${unusedIdeas.length} ideas sin usar disponibles)...`);

  for (let i = 0; i < selected.length; i++) {
    const idea = selected[i]!;
    const brandPillar = pillarNames[i % pillarNames.length]!;
    const prompt = buildPrompt(brand, idea.ideaText, brandPillar, brandBrain, reelExamples);
    const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-content-brief-generator" });

    let text = result.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) text = fenced[1].trim();
    const parsed = JSON.parse(text);

    const brief: ContentBrief = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending_review",
      ideaId: idea.ideaId,
      ideaText: idea.ideaText,
      brandPillar,
      ...parsed,
    };
    await writeData(`content-briefs/${brief.id}.json`, brief);
    console.log(`  [${brief.brandPillar}] "${brief.hook}" -> data/content-briefs/${brief.id}.json`);
  }

  console.log(`\n${selected.length} briefs guardados en data/content-briefs/, status: pending_review.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors (this depends on Task 1's `ContentBrief` type and Task 3's `idea-library.ts`, both already in place).

**Step 3 [COSTS MONEY — run only when ready]:**

Run: `npm run generate:briefs`
Expected: new files in `data/content-briefs/`, one per unused idea (up to 5), each a valid `ContentBrief` JSON.

**Step 4: Commit**

```bash
git add src/scripts/generate-briefs.ts
git commit -m "refactor: generate-briefs.ts now reads Idea Library, never scraped reels"
```

---

### Task 9: `generate-script.ts` (approved `ContentBrief` → `ReelScript` beats)

This is today's beat-generation logic from the old `generate-briefs.ts`, moved
here and retargeted to consume an approved `ContentBrief` instead of raw
inspiration reels, with the trend report as optional presentation-only
enrichment.

**Files:**
- Create: `src/scripts/generate-script.ts`
- Modify: `package.json`

**Step 1: Write the script**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { getBrand } from "../lib/brand.js";
import { loadBrandBrainFoundation, loadBrandBrainReelExamples } from "../lib/brand-brain.js";
import { loadLatestTrendReport } from "../lib/trend-report.js";
import { readData, writeData } from "../lib/data.js";
import { runClaudeAgent } from "../lib/claude-agent.js";
import type { ContentBrief } from "../types/content-brief.js";
import type { ReelScript } from "../types/reel-script.js";

function buildPrompt(
  brand: Awaited<ReturnType<typeof getBrand>>,
  brief: ContentBrief,
  brandBrain: string | null,
  reelExamples: string | null,
  trendReport: string | null
): string {
  const brandBrainBlock = brandBrain
    ? `## Editorial foundation — non-negotiable, overrides everything below if they ever conflict
Every beat's voiceover and onScreenText must follow this — British English, the specific voice described, and especially the guardrails (never claim cultural superiority in either direction, never treat one household/region as representative of all Argentina, never use "authentic" as an unsupported verdict, never imitate accents or use stereotypes, never let a hook shame the audience or conceal the subject).

${brandBrain}

---
`
    : "";

  const reelExamplesBlock = reelExamples
    ? `## Gold-standard reel examples — not optional inspiration
The examples below are approved reference briefs. They define the expected level of specificity, curiosity, cultural insight, emotional restraint and narrative clarity. Generate a script comparable to these, while NEVER copying their wording, hooks or topics, and NEVER inventing personal memories, people or quotations that aren't already grounded in the brand brain above or in the approved brief below.

${reelExamples}

---
`
    : "";

  const trendReportBlock = trendReport
    ? `## Current market trends — for PRESENTATION STYLE ONLY, never for topic
The topic, message and cultural insight are already fixed by the approved brief below — do not let this section change what the piece is about. Use it only to inform hook phrasing style, pacing, typical duration and CTA phrasing.

${trendReport}

---
`
    : "";

  return `You are a senior Instagram Reels content strategist for "${brand.name}", turning one already-approved Content Brief into a beat-by-beat reel script.

${brandBrainBlock}${reelExamplesBlock}${trendReportBlock}## Approved Content Brief
- Hook: ${brief.hook}
- Core message: ${brief.coreMessage}
- Cultural insight: ${brief.culturalInsight}
${brief.personalStory ? `- Personal story: ${brief.personalStory}\n` : ""}- Educational value: ${brief.educationalValue}
- CTA: ${brief.cta}
- Brand pillar: ${brief.brandPillar}
- Editorial territory: ${brief.editorialTerritory}

## Task
Break this brief into a sequence of beats. A beat is ONE shot of real footage. For each beat, separate three things that must never be mixed into one string:
- "visual": what the camera shows (a direction for whoever is filming/editing — never spoken, never on screen as text)
- "voiceover": the exact words a narrator says out loud for this beat, or omit the field entirely if this beat is silent
- "onScreenText": short text overlay shown during this beat, or omit if none

Respond with ONLY a raw JSON object (no markdown fences, no prose before or after), with this shape:
{
  "topic": "<one-sentence restatement of what this piece covers>",
  "contentPattern": "<the structural pattern used, e.g. Cultural Doorway, Useful Correction, Myth-busting>",
  "beats": [
    { "visual": "<shot direction>", "voiceover": "<spoken line, omit if silent>", "onScreenText": "<overlay text, omit if none>", "estimatedSeconds": <integer, 2-8> }
  ],
  "estimatedDurationSeconds": <integer, 15-60, should roughly equal the sum of beat estimatedSeconds>
}`;
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.log("Uso: npm run generate:script -- <contentBriefId>");
    return;
  }

  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  if (brief.status !== "approved") {
    console.log(`El brief ${id} todavía está en status "${brief.status}". Corré \`npm run briefs:approve ${id}\` primero.`);
    return;
  }

  const brand = await getBrand();
  const brandBrain = await loadBrandBrainFoundation();
  const reelExamples = await loadBrandBrainReelExamples();
  const trendReport = await loadLatestTrendReport();

  console.log(`Generando guion para "${brief.hook}"...`);
  const prompt = buildPrompt(brand, brief, brandBrain, reelExamples, trendReport);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-script-generator" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const parsed = JSON.parse(text);

  const script: ReelScript = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending_review",
    contentBriefId: brief.id,
    brandPillar: brief.brandPillar,
    editorialTerritory: brief.editorialTerritory,
    hook: brief.hook,
    cta: brief.cta,
    inspiredBy: [],
    ...parsed,
  };
  await writeData(`reel-scripts/${script.id}.json`, script);
  console.log(`\nGuion guardado en data/reel-scripts/${script.id}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 2: Add the npm script**

```json
"generate:script": "tsx src/scripts/generate-script.ts",
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 4 [COSTS MONEY — run only when ready]:**

Run: `npm run generate:script -- <a content-brief id with status "approved">`
Expected: a new `data/reel-scripts/<id>.json`.

**Step 5: Commit**

```bash
git add src/scripts/generate-script.ts package.json
git commit -m "feat: add generate:script (approved ContentBrief -> ReelScript beats)"
```

---

### Task 10: Point voiceover/EDL/render/publish scripts at `data/reel-scripts/`

**Files:**
- Modify: `src/scripts/generate-voiceover.ts`
- Modify: `src/scripts/generate-edl.ts`
- Modify: `src/scripts/render-reel.ts`
- Modify: `src/scripts/publish-reel.ts`

**Step 1: In each file, replace every occurrence of the string `` `briefs/${id}.json` `` with `` `reel-scripts/${id}.json` ``**

Run this to find every occurrence first:
```bash
grep -n 'briefs/\${id}' src/scripts/generate-voiceover.ts src/scripts/generate-edl.ts src/scripts/render-reel.ts src/scripts/publish-reel.ts
```

Edit each match found. Also update any `Corré \`npm run briefs:approve ...\`` message
strings to say `scripts:approve` instead (this matches the npm script name
introduced in Task 11).

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors (these files already import `ReelScript` from Task 2, only the
data path string literals change here).

**Step 3: Commit**

```bash
git add src/scripts/generate-voiceover.ts src/scripts/generate-edl.ts src/scripts/render-reel.ts src/scripts/publish-reel.ts
git commit -m "refactor: point production scripts at data/reel-scripts/"
```

---

### Task 11: Split `approve-brief.ts` into two approval CLIs

**Files:**
- Create: `src/scripts/approve-content-brief.ts`
- Create: `src/scripts/approve-script.ts`
- Delete: `src/scripts/approve-brief.ts`
- Modify: `package.json`

**Step 1: Write `approve-content-brief.ts`**

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import type { ContentBrief } from "../types/content-brief.js";

async function listBriefs() {
  const dir = path.resolve(process.cwd(), "data", "content-briefs");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }
  console.log("Uso: npm run briefs:approve <id> [--reject]\n");
  if (files.length === 0) {
    console.log("No hay content briefs en data/content-briefs/. Corré `npm run generate:briefs` primero.");
    return;
  }
  console.log("Content briefs disponibles:");
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const brief = await readData<ContentBrief>(`content-briefs/${file}`);
    console.log(`  [${brief.status}] ${brief.id}  (${brief.brandPillar}) "${brief.hook}"`);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    await listBriefs();
    return;
  }

  const reject = process.argv.includes("--reject");
  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  brief.status = reject ? "rejected" : "approved";
  await writeData(`content-briefs/${id}.json`, brief);
  console.log(`Content brief ${id} ${reject ? "rechazado" : "aprobado"}: "${brief.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 2: Write `approve-script.ts`** (same shape, targets `data/reel-scripts/`
and `ReelScript`)

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readData, writeData } from "../lib/data.js";
import type { ReelScript } from "../types/reel-script.js";

async function listScripts() {
  const dir = path.resolve(process.cwd(), "data", "reel-scripts");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }
  console.log("Uso: npm run scripts:approve <id> [--reject]\n");
  if (files.length === 0) {
    console.log("No hay guiones en data/reel-scripts/. Corré `npm run generate:script -- <contentBriefId>` primero.");
    return;
  }
  console.log("Guiones disponibles:");
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const script = await readData<ReelScript>(`reel-scripts/${file}`);
    console.log(`  [${script.status}] ${script.id}  (${script.brandPillar}) "${script.hook}"`);
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    await listScripts();
    return;
  }

  const reject = process.argv.includes("--reject");
  const script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  script.status = reject ? "rejected" : "approved";
  await writeData(`reel-scripts/${id}.json`, script);
  console.log(`Guion ${id} ${reject ? "rechazado" : "aprobado"}: "${script.hook}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

**Step 3: Delete the old file and update `package.json`**

```bash
rm src/scripts/approve-brief.ts
```

Replace `"briefs:approve": "tsx src/scripts/approve-brief.ts",` with:
```json
"briefs:approve": "tsx src/scripts/approve-content-brief.ts",
"scripts:approve": "tsx src/scripts/approve-script.ts",
```

**Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: split approve-brief.ts into content-brief and script approval CLIs"
```

---

### Task 12: `/api/content-briefs/*` routes

**Files:**
- Create: `src/app/api/content-briefs/route.ts`
- Create: `src/app/api/content-briefs/[id]/route.ts`
- Create: `src/app/api/content-briefs/[id]/approve/route.ts`
- Create: `src/app/api/content-briefs/[id]/reject/route.ts`

These mirror the existing `src/app/api/briefs/route.ts` and
`src/app/api/briefs/[id]/{route,approve/route,reject/route}.ts` exactly,
swapping `ReelBrief`/`briefs` for `ContentBrief`/`content-briefs`.

**Step 1: `route.ts` (list)**

```ts
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
```

**Step 2: `[id]/route.ts` (detail)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ error: "Content brief not found" }, { status: 404 });
  }
}
```

**Step 3: `[id]/approve/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  brief.status = "approved";
  await writeData(`content-briefs/${id}.json`, brief);
  return NextResponse.json({ brief });
}
```

**Step 4: `[id]/reject/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data";
import type { ContentBrief } from "@/types/content-brief";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await readData<ContentBrief>(`content-briefs/${id}.json`);
  brief.status = "rejected";
  await writeData(`content-briefs/${id}.json`, brief);
  return NextResponse.json({ brief });
}
```

**Step 5: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 6: Commit**

```bash
git add src/app/api/content-briefs
git commit -m "feat: add /api/content-briefs CRUD routes"
```

---

### Task 13: Rename `/api/briefs/*` → `/api/scripts/*`

**Files:**
- Move: `src/app/api/briefs/route.ts` → `src/app/api/scripts/route.ts`
- Move: `src/app/api/briefs/[id]/route.ts` → `src/app/api/scripts/[id]/route.ts`
- Move: `src/app/api/briefs/[id]/approve/route.ts` → `src/app/api/scripts/[id]/approve/route.ts`
- Move: `src/app/api/briefs/[id]/reject/route.ts` → `src/app/api/scripts/[id]/reject/route.ts`
- Move: `src/app/api/briefs/[id]/produce/route.ts` → `src/app/api/scripts/[id]/produce/route.ts`
- Move: `src/app/api/briefs/[id]/publish/route.ts` → `src/app/api/scripts/[id]/publish/route.ts`

**Step 1: Move the directory and update path/type references**

```bash
git mv src/app/api/briefs src/app/api/scripts
```

In `src/app/api/scripts/route.ts`, `src/app/api/scripts/[id]/route.ts`,
`src/app/api/scripts/[id]/approve/route.ts`, `src/app/api/scripts/[id]/reject/route.ts`:
replace `@/types/brief` → `@/types/reel-script`, `ReelBrief` → `ReelScript`,
and every `` `briefs/${...}` `` / `"briefs"` path-string with `` `reel-scripts/${...}` `` / `"reel-scripts"`.

`src/app/api/scripts/[id]/produce/route.ts` and `.../publish/route.ts` don't
reference the type or the data path directly (they just shell out to npm
scripts) — check with `grep -n "briefs\|ReelBrief" src/app/api/scripts/[id]/produce/route.ts src/app/api/scripts/[id]/publish/route.ts`
and fix if anything matches.

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors (this is the last thing referencing the old `@/types/brief`
path, so this should be the point where the full project goes green again).

Run: `grep -rn "@/types/brief\b\|types/brief\.js" src`
Expected: no matches anywhere in the project.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename /api/briefs to /api/scripts"
```

---

### Task 14: Components — `ContentBriefCard` and rename `BriefCard` → `ScriptCard`

**Files:**
- Create: `src/components/ContentBriefCard.tsx`
- Move: `src/components/BriefCard.tsx` → `src/components/ScriptCard.tsx`

**Step 1: Rename and retarget `BriefCard`**

```bash
git mv src/components/BriefCard.tsx src/components/ScriptCard.tsx
```

In `src/components/ScriptCard.tsx`: replace `@/types/brief` with
`@/types/reel-script`, `ReelBrief` with `ReelScript`, rename the exported
function `BriefCard` to `ScriptCard`, and change the link target from
`` `/briefs/${brief.id}` `` to `` `/scripts/${script.id}` `` (rename the
`brief` param/prop to `script` throughout for clarity, matching the new
vocabulary).

**Step 2: Write `ContentBriefCard.tsx`** (same shape, no `contentPattern`
field since `ContentBrief` doesn't have one — show `editorialTerritory` only)

```tsx
import Link from "next/link";
import { Badge } from "./ui/badge";
import type { ContentBrief } from "@/types/content-brief";

const statusVariant: Record<ContentBrief["status"], "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending_review: "warning",
  approved: "default",
  rejected: "destructive",
};

const statusLabel: Record<ContentBrief["status"], string> = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export function ContentBriefCard({ brief }: { brief: ContentBrief }) {
  return (
    <Link
      href={`/content-briefs/${brief.id}`}
      className="cr-enter block rounded-xl border border-border bg-surface p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline">{brief.brandPillar}</Badge>
        <Badge variant={statusVariant[brief.status] ?? "secondary"}>
          {statusLabel[brief.status] ?? brief.status}
        </Badge>
      </div>
      <p className="text-sm font-semibold leading-snug">{brief.hook}</p>
      <p className="text-xs text-muted-foreground mt-1">{brief.editorialTerritory}</p>
    </Link>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: errors only in `src/app/page.tsx` and `src/app/briefs/[id]/page.tsx`
(not yet updated — that's Task 15/16). No errors in the two component files
themselves.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ContentBriefCard, rename BriefCard to ScriptCard"
```

---

### Task 15: Pages — `/content-briefs/[id]` and rename `/briefs/[id]` → `/scripts/[id]`

**Files:**
- Create: `src/app/content-briefs/[id]/page.tsx`
- Move: `src/app/briefs/[id]/page.tsx` → `src/app/scripts/[id]/page.tsx`

**Step 1: Rename and retarget the script detail page**

```bash
git mv "src/app/briefs/[id]" "src/app/scripts/[id]"
```

In `src/app/scripts/[id]/page.tsx`: replace `@/types/brief` with
`@/types/reel-script`, `ReelBrief` with `ReelScript`, every
`` `/api/briefs/${id}` `` / `` `/api/briefs/${id}/${action}` `` fetch URL with
`` `/api/scripts/${id}` `` / `` `/api/scripts/${id}/${action}` ``, and the
`Link href="/"` back-link stays as-is (goes to the dashboard).

**Step 2: Write `src/app/content-briefs/[id]/page.tsx`**

Same structure as the script detail page, but without the beats/produce/publish
sections — just the brief fields, approve/reject, and (once approved) a
button to generate the script.

```tsx
"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { ContentBrief } from "@/types/content-brief";

export default function ContentBriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [brief, setBrief] = useState<ContentBrief | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/content-briefs/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setBrief(data.brief);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, setState happens after the await
    load();
  }, [load]);

  if (!brief) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  const setStatus = async (action: "approve" | "reject") => {
    await fetch(`/api/content-briefs/${id}/${action}`, { method: "POST" });
    load();
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{brief.brandPillar}</Badge>
          <Badge variant="secondary">{brief.editorialTerritory}</Badge>
        </div>
        <h1 className="text-2xl font-bold mt-2 leading-snug">{brief.hook}</h1>
        <p className="text-xs text-muted-foreground mt-1">Idea original: {brief.ideaText}</p>
      </header>

      {(brief.status === "pending_review" || brief.status === "approved") && (
        <div className="flex gap-2">
          {brief.status === "pending_review" && (
            <Button variant="accent" onClick={() => setStatus("approve")}>
              Aprobar
            </Button>
          )}
          <Button variant="outline" onClick={() => setStatus("reject")}>
            Rechazar
          </Button>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Mensaje central</h2>
          <p className="text-sm">{brief.coreMessage}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Insight cultural</h2>
          <p className="text-sm">{brief.culturalInsight}</p>
        </div>
        {brief.personalStory && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Historia personal</h2>
            <p className="text-sm">{brief.personalStory}</p>
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Valor educativo</h2>
          <p className="text-sm">{brief.educationalValue}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">CTA</h2>
          <p className="text-sm">{brief.cta}</p>
        </div>
      </section>

      {brief.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Generar guion</h2>
          <PipelineRunner
            url={`/api/content-briefs/${id}/generate-script`}
            triggerLabel="Generar guion"
            runningLabel="Generando…"
            initialSteps={["Script"]}
            onSuccess={load}
          />
        </section>
      )}
    </main>
  );
}
```

Note this references `/api/content-briefs/${id}/generate-script`, which is
created in Task 16 (it wasn't in Task 12's list — Task 12 was pure CRUD,
this one shells out to a script like `produce` does).

**Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: errors remaining only in `src/app/page.tsx` (Task 17) and the
missing `/api/content-briefs/[id]/generate-script` route (Task 16) — this is
expected mid-task, not a stopping point.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add content brief detail page, rename briefs/[id] to scripts/[id]"
```

---

### Task 16: `/api/content-briefs/[id]/generate-script` route

**Files:**
- Create: `src/app/api/content-briefs/[id]/generate-script/route.ts`

**Step 1: Write the route** (mirrors `src/app/api/briefs/[id]/produce/route.ts`'s
single-step SSE pattern)

```ts
import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = streamNpmScripts([{ label: "Script", args: ["generate:script", "--", id] }]);
  return sseResponse(stream);
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors remaining except `src/app/page.tsx` (Task 17).

**Step 3: Commit**

```bash
git add src/app/api/content-briefs/[id]/generate-script
git commit -m "feat: add generate-script trigger route for content briefs"
```

---

### Task 17: Root dashboard — two sections, two research/ideation buttons

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace the file contents**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { ContentBriefCard } from "@/components/ContentBriefCard";
import { ScriptCard } from "@/components/ScriptCard";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { ContentBrief } from "@/types/content-brief";
import type { ReelScript } from "@/types/reel-script";

const BRIEF_STATUS_ORDER: ContentBrief["status"][] = ["pending_review", "approved", "rejected"];
const BRIEF_STATUS_TITLE: Record<ContentBrief["status"], string> = {
  pending_review: "Briefs pendientes de revisión",
  approved: "Briefs aprobados",
  rejected: "Briefs rechazados",
};

const SCRIPT_STATUS_ORDER: ReelScript["status"][] = ["pending_review", "approved", "published", "rejected"];
const SCRIPT_STATUS_TITLE: Record<ReelScript["status"], string> = {
  pending_review: "Guiones pendientes de revisión",
  approved: "Guiones aprobados",
  published: "Publicados",
  rejected: "Guiones rechazados",
};

export default function DashboardPage() {
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [scripts, setScripts] = useState<ReelScript[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [briefsRes, scriptsRes] = await Promise.all([fetch("/api/content-briefs"), fetch("/api/scripts")]);
    const briefsData = await briefsRes.json();
    const scriptsData = await scriptsRes.json();
    setBriefs(briefsData.briefs);
    setScripts(scriptsData.briefs); // /api/scripts still returns { briefs } for now, see Task 13
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, setState happens after the await
    load();
  }, [load]);

  const groupedBriefs = BRIEF_STATUS_ORDER.map((status) => ({
    status,
    items: briefs.filter((b) => b.status === status),
  })).filter((g) => g.items.length > 0);

  const groupedScripts = SCRIPT_STATUS_ORDER.map((status) => ({
    status,
    items: scripts.filter((s) => s.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Chef Rulo — Reels Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Research → briefs → guion → producción → publicación, todo local.
        </p>
      </header>

      <section className="mb-10 flex flex-wrap gap-3">
        <PipelineRunner
          url="/api/research"
          triggerLabel="Correr research"
          runningLabel="Scrapeando y analizando tendencias…"
          initialSteps={["Scrape", "Trend report"]}
          onSuccess={load}
        />
        <PipelineRunner
          url="/api/content-briefs/generate"
          triggerLabel="Generar briefs desde Idea Library"
          runningLabel="Generando briefs…"
          initialSteps={["Briefs"]}
          onSuccess={load}
        />
      </section>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && briefs.length === 0 && scripts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay briefs. Corré research y generá briefs para empezar.
        </p>
      )}

      {groupedBriefs.map((group) => (
        <section key={`brief-${group.status}`} className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {BRIEF_STATUS_TITLE[group.status]} ({group.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((brief) => (
              <ContentBriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </section>
      ))}

      {groupedScripts.map((group) => (
        <section key={`script-${group.status}`} className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {SCRIPT_STATUS_TITLE[group.status]} ({group.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
```

This references two API routes that don't exist yet:
`/api/research` (rename target for the research trigger — check whether
`src/app/api/research/route.ts` already exists and what it streams; update it
to run `scrape:inspiration` + `generate:trend-report` instead of whatever it
runs today) and `/api/content-briefs/generate` (new — streams `generate:briefs`).

**Step 2: Check and fix the existing research route**

Run: `cat src/app/api/research/route.ts`. If it streams the old
`pipeline:research` steps (`Research`, `Briefs`), update its `streamNpmScripts`
call to:
```ts
streamNpmScripts([
  { label: "Scrape", args: ["scrape:inspiration"] },
  { label: "Trend report", args: ["generate:trend-report"] },
])
```
matching the `initialSteps={["Scrape", "Trend report"]}` used above.

**Step 3: Create `src/app/api/content-briefs/generate/route.ts`**

```ts
import { NextRequest } from "next/server";
import { sseResponse, streamNpmScripts } from "@/lib/stream-command";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest) {
  const stream = streamNpmScripts([{ label: "Briefs", args: ["generate:briefs"] }]);
  return sseResponse(stream);
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors anywhere in the project. This is the point where the
whole refactor should be green.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: split dashboard into Briefs/Scripts sections with separate research and ideation triggers"
```

---

### Task 18: README update

**Files:**
- Modify: `README.md`

**Step 1: Update the pipeline description**

Rewrite the "Pipeline" section to describe the new stages (Research
Intelligence → trend reports; Editorial Content Engine → ideas → briefs →
scripts → produce → publish), replacing references to `data/briefs/` with
`data/content-briefs/` and `data/reel-scripts/`, and to `npm run generate:briefs`
now meaning idea-to-brief rather than reel-to-script. Also update the "Brand
Brain" section to mention `knowledge/15-idea-library/` alongside
`knowledge/10-editorial-territories/`. Reference
`docs/decisions/2026-08-02-separate-research-from-content-creation.md` for
the full rationale instead of re-explaining it inline.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for the research/content-engine split"
```

---

### Task 19: Full verification pass

**Step 1: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

**Step 2: Lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable if they pre-exist on `main` — compare
with `git stash` + `npm run lint` on `main` if unsure whether a warning is new).

**Step 3: Manual smoke test of the dashboard**

Run: `npm run dev`, open `http://localhost:3000`, confirm:
- Page loads with two empty-state sections (no data yet in this fresh worktree).
- "Correr research" button is present and triggers the SSE flow (safe to click
  — real scrape, costs an Apify credit; skip if you don't want to spend one).
- "Generar briefs desde Idea Library" button is present.
- Navigating to a nonexistent `/content-briefs/x` and `/scripts/x` both show
  the "Cargando…" state without crashing (no data exists yet, so no need to
  fully exercise the approve/reject/generate flow here — that was already
  spot-checked per-task above via `tsc`).

**Step 4: Final commit if anything was fixed during verification**

```bash
git add -A
git commit -m "chore: fix issues found during verification pass"
```
