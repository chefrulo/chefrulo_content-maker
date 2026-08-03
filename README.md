# chefrulo_content-maker

Local-first Instagram Reels pipeline for Chef Rulo & Family, orchestrated with Claude Code. Same philosophy as [Open Carrusel](https://github.com/Hainrixz/open-carrusel) — everything runs on your machine, Claude CLI as a subprocess agent, no data leaves except to the APIs each step actually needs.

The system is split into two independent engines: a **Research Intelligence** engine that watches what's working on Instagram (and never generates content), and an **Editorial Content Engine** that turns the Chef Rulo Brand Brain into ideas, briefs, scripts, and finished reels (and never starts from influencer content). See `docs/decisions/2026-08-02-separate-research-from-content-creation.md` for the full rationale behind that split.

## Requirements

- Node 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [`cloudflared`](https://github.com/cloudflare/cloudflared) on PATH — only needed for Phase 6 (publish)
- A local clone of the `chef-rulo-brand-brain` repo, with `BRAND_BRAIN_PATH` pointing at it — required for idea and brief generation, see "Brand Brain" below
- Accounts/tokens: Meta (Instagram Graph API), Apify, OpenAI — `npm run doctor` tells you what's missing

## Setup

```bash
npm install
npm run setup
npm run doctor
```

Fill in `.env.local` (copied from `.env.example`) as each phase below needs it.

## Brand Brain (required)

`chef-rulo-brand-brain` (separate local repo, e.g. `/home/eduardo/dev/chef-rulo-brand-brain`) is the canonical source of truth for everything the Editorial Content Engine writes: positioning, editorial manifesto, British-English writing style, non-negotiable guardrails (no claims of cultural superiority, no "authentic" as an unsupported verdict, no stereotypes, no generalising a single household as all of Argentina), canonical articles, and the idea library. Point `BRAND_BRAIN_PATH` in `.env.local` at a local clone of that repo — `npm run generate:ideas` and `npm run generate:briefs` both require it and refuse to run without it; there is no degraded/no-guardrails mode any more. `npm run doctor` checks that it's set and that the repo looks right.

That repo also defines **editorial territories** (`knowledge/10-editorial-territories/`, e.g. "Argentine Cooking Techniques", "Family Memory") and the **idea library** (`knowledge/15-idea-library/`, one Markdown file per canonical article, e.g. `knowledge/15-idea-library/asado.md`) — concrete subject-matter areas and the permanent bank of reel-idea questions generated from each canonical article, a different axis from this repo's commercial **brand pillars** (`data/brand.json`, e.g. Product & Craft, Culture & Identity). Every content brief tags both a brand pillar and an editorial territory, plus a specific `topic` and a `contentPattern` (the structural pattern used, e.g. "Cultural Doorway"):

```json
{
  "brandPillar": "Culture & Identity",
  "editorialTerritory": "Argentine Table Culture",
  "topic": "Why food is often served for the whole table",
  "contentPattern": "Cultural Doorway"
}
```

See `knowledge/00-foundation/06-content-taxonomy.md` in the brand brain repo for the full explanation and common pillar↔territory pairings (loose, many-to-many — not a rigid hierarchy).

## Pipeline

The two engines run as one sequence of numbered steps. Steps 1–2 are Research Intelligence (pure market observation, never produces content). Steps 3–8 are the Editorial Content Engine (always starts from the Brand Brain, never from influencer content). **Step 3 is CLI-only and easy to miss** — see the callout below.

### 1. Scrape inspiration accounts

```bash
npm run scrape:inspiration
```

Scrapes recent reels from the accounts in `data/inspiration-accounts.json` (via Apify) into `data/inspiration-reels/`. Pure data collection, no content generated.

### 2. Generate a trend report

```bash
npm run generate:trend-report
```

Asks Claude to analyse the scraped reels for what's working — top hook patterns, formats, average duration, CTA and emotional patterns, posting frequency, saturated topics, emerging opportunities — and writes `data/trend-reports/<date>.json`. Steps 1–2 together: `npm run pipeline:research`.

### 3. Generate ideas from a canonical article (CLI-only, do this before using the dashboard)

```bash
npm run generate:ideas -- <article-slug>
```

Reads `knowledge/20-articles/<article-slug>.md` from the Brand Brain repo and asks Claude to generate 8–12 concrete reel-idea questions grounded only in that article, appending the new ones to the permanent idea library at `knowledge/15-idea-library/<article-slug>.md` in the Brand Brain repo. Requires `BRAND_BRAIN_PATH` — there is no degraded mode, the command errors out without it.

> **This step is not exposed as a dashboard button.** The web UI's "Correr research" button only runs steps 1–2, and "Generar briefs desde Idea Library" only runs step 4. If you click both from a fresh checkout without ever running `generate:ideas` from the terminal, brief generation will report success (green checkmark, no error) but create zero new briefs — silently, because the idea library has nothing unused in it yet. You must run this command from the terminal, for at least one article slug, before the dashboard's brief-generation button will do anything useful.

### 4. Generate content briefs from the idea library

```bash
npm run generate:briefs
```

Reads all unused ideas from `knowledge/15-idea-library/` across the Brand Brain repo and asks Claude to turn each into an abstract `ContentBrief` — hook, core message, cultural insight, optional personal story, educational value, CTA, plus a brand pillar, editorial territory, topic and content pattern (see Brand Brain above) — written to `data/content-briefs/<id>.json`. No beats yet; this is not a video script. Also requires `BRAND_BRAIN_PATH`.

### 5. Approve a content brief

```bash
npm run briefs:approve <id>      # or with no id, to list all briefs
```

Approving a `ContentBrief` doesn't produce video — it marks a reusable editorial asset as ready to become content. In principle an approved brief could become a reel, carousel, article, or newsletter; today this pipeline only builds reels from it.

### 6. Generate a reel script from an approved brief

```bash
npm run generate:script -- <contentBriefId>
```

Takes an *approved* `ContentBrief` and asks Claude to produce the beat-by-beat `ReelScript` (visual / voiceover / on-screen text per beat), written to `data/reel-scripts/<id>.json`. This optionally reads the most recent trend report, but only for presentation-style enrichment — hook phrasing, pacing, CTA style. It never touches topic, which is already fixed by the brief; research improves how a script says something, never what it says.

### 7. Approve the script

```bash
npm run scripts:approve <id>      # or with no id, to list all scripts
```

Refuses to touch a script that's already `published`.

### 8. Produce and publish

```bash
npm run pipeline:produce <reelScriptId>
npm run publish:reel <reelScriptId>
```

`pipeline:produce` generates per-beat voiceover (OpenAI TTS), builds an EDL mapping beats to real footage in `footage/<reelScriptId>/` (falls back to brand-styled text cards for beats without footage), and renders the final MP4 to `data/exports/<reelScriptId>.mp4`. To use real footage: drop clips into `footage/<reelScriptId>/` before this step.

`publish:reel` needs no VPS: the Graph API needs a public HTTPS URL to fetch the video from, so this spins up a local HTTP server plus a [cloudflared](https://github.com/cloudflare/cloudflared) quick tunnel (no account/signup needed) just long enough for Meta's servers to download it, then tears both down. Requires `cloudflared` on PATH (`npm run doctor` checks for it). Requires typing `publicar` to confirm — this hits your real, public Instagram account.

## Web UI

```bash
npm run dev
```

Opens a dashboard at `localhost:3000` — same underlying pipeline, no CLI needed, for everything except step 3 (see the callout above — `generate:ideas` must be run from the terminal). Two trigger buttons: "Correr research" (steps 1–2) and "Generar briefs desde Idea Library" (step 4). Two sections below, each grouped by status with its own detail page: **Briefs** (`/content-briefs/[id]`, approve/reject a `ContentBrief` and trigger script generation) and **Guiones** (`/scripts/[id]`, approve/reject a `ReelScript`, produce it — streamed — preview the video, and publish, still gated behind typing `publicar` in an input before the publish button enables). Reuses the UI components and Tailwind theme from [Open Carrusel](https://github.com/Hainrixz/open-carrusel).

## Individual steps

Each pipeline stage is also its own command, in case you want to rerun just one:

```bash
npm run scrape:inspiration               # 1. scrape inspiration accounts
npm run generate:trend-report            # 2. build a trend report from the scrape
npm run generate:ideas -- <slug>         # 3. article -> idea library (CLI-only, Brand Brain repo)
npm run generate:briefs                  # 4. idea library -> ContentBrief[]
npm run briefs:approve <id>              # 5. approve/reject a ContentBrief
npm run generate:script -- <id>          # 6. approved ContentBrief -> ReelScript
npm run scripts:approve <id>             # 7. approve/reject a ReelScript
npm run generate:voiceover <id>          # 8a. TTS per beat
npm run generate:edl <id>                # 8b. beat -> footage/text-card mapping
npm run render:reel <id>                 # 8c. render the MP4
npm run publish:reel <id>                # 8d. publish to Instagram
```

`pipeline:research` chains steps 1–2; `pipeline:produce <id>` chains 8a–8c.

## Claude Code + MCP

```bash
npm run claude              # interactive session, .mcp.json auto-loaded (approve the Instagram MCP server once)
npm run test:ig-insights    # non-interactive sanity check against your real IG account
```

## Known quirks

- `GET /api/scripts` returns `ReelScript[]` (not `ReelBrief[]`) but the JSON key is still `{ briefs: [...] }`, a naming leftover from before the rename that was left alone to avoid unnecessary churn. The dashboard already handles this correctly (`src/app/page.tsx` reads `scriptsData.briefs`); this only matters if you call the API directly.

## Data layout

All local, all gitignored except explicit `.example` templates. Everything under `data/` is produced by the Editorial Content Engine or Research Intelligence; the idea library lives outside this repo, in the Brand Brain repo at `BRAND_BRAIN_PATH`.

```text
data/brand.json                  brand + commercial brand pillars (seeded by npm run setup)
data/inspiration-accounts.json   handles to scrape (see inspiration-accounts.example.json)
data/inspiration-reels/          scraped reel data per handle
data/trend-reports/<date>.json   trend report from generate:trend-report
data/content-briefs/<id>.json    abstract ContentBriefs (pending_review → approved → rejected)
data/reel-scripts/<id>.json      beat-by-beat ReelScripts (pending_review → approved → published → rejected)
data/voiceovers/<id>/            TTS audio per beat + timeline.json
data/edl/<id>.json               beat → footage/text-card mapping
data/exports/<id>.mp4            final rendered video
footage/<id>/                    your real clips for a reel script (you provide these)
```

Outside this repo, in the Brand Brain repo:

```text
knowledge/20-articles/<slug>.md       canonical articles (input to generate:ideas)
knowledge/15-idea-library/<slug>.md   permanent bank of reel-idea questions per article
```

## Status

The full research/content-engine split described in `docs/decisions/2026-08-02-separate-research-from-content-creation.md` is implemented: Research Intelligence (scrape → trend report) and the Editorial Content Engine (idea library → content briefs → reel scripts → produce → publish) run as separate stages, each with its own data files and its own approval gate. Verified with real data/credentials, except the actual Graph API publish call — that step is gated behind typing `publicar` and hasn't been run for a real post yet.

What's left before this is fully in day-to-day use:

- **Real footage** — no clips exist yet, so every reel currently renders with text-card fallbacks. Drop clips into `footage/<reelScriptId>/` before `generate:edl` to use real video; sanity-check the AI-suggested trim points in `data/edl/<id>.json` before rendering, since Claude picks them from filenames/durations, not by watching the footage.
- **First real publish** — run `npm run publish:reel <reelScriptId>` yourself when a video is ready; nothing publishes automatically.
- **No background music yet** — no royalty-free tracks are wired in.
- **No caption/hashtag generation** — publish captions are just `hook + cta`; can be extended if you want fuller Instagram captions.
- **No feedback loop** — content briefs are grounded in the Brand Brain's idea library, never in inspiration-account performance (that's the whole point of the split — see the ADR); there's also no loop yet feeding Chef Rulo's own post history/insights back into idea or brief generation, even though the MCP tools for that are already wired up.
- **`generate:ideas` is CLI-only** — see the callout in the Pipeline section above; it's not on the dashboard yet.
