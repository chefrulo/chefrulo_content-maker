# chefrulo_content-maker

Local-first editorial production system for Chef Rulo & Family, orchestrated with Claude Code. It turns approved briefs into reels or pixel-perfect Instagram carousels; everything runs on your machine and no data leaves except to the APIs each step actually needs.

The system is split into two independent engines: a **Research Intelligence** engine that watches what's working on Instagram (and never generates content), and an **Editorial Content Engine** that turns the Chef Rulo Brand Brain into ideas, briefs, reel scripts, carousels and finished assets (and never starts from influencer content). See `docs/decisions/2026-08-02-separate-research-from-content-creation.md` for the full rationale behind that split.

## Requirements

- Node 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [`cloudflared`](https://github.com/cloudflare/cloudflared) on PATH — only needed for step 8 (produce and publish)
- A local clone of the [`chef-rulo-brand-brain`](https://github.com/chefrulo/chef-rulo-brand-brain) repo, with `BRAND_BRAIN_PATH` pointing at it — required for idea and brief generation, see "Brand Brain" below
- Accounts/tokens: Meta (Instagram Graph API), Apify, OpenAI — `npm run doctor` tells you what's missing

## Setup

```bash
npm install
npm run setup
npm run doctor
```

Fill in `.env.local` (copied from `.env.example`) as each step below needs it.

## Brand Brain (required)

[`chef-rulo-brand-brain`](https://github.com/chefrulo/chef-rulo-brand-brain) (separate local repo, e.g. `/home/eduardo/dev/chef-rulo-brand-brain`) is the canonical source of truth for everything the Editorial Content Engine writes: positioning, editorial manifesto, British-English writing style, non-negotiable guardrails (no claims of cultural superiority, no "authentic" as an unsupported verdict, no stereotypes, no generalising a single household as all of Argentina), canonical articles, and the idea library. Point `BRAND_BRAIN_PATH` in `.env.local` at a local clone of that repo — `npm run generate:ideas` and `npm run generate:briefs` both require it and refuse to run without it; there is no degraded/no-guardrails mode any more. `npm run doctor` checks that it's set and that the repo looks right.

That repo also defines **editorial territories** (`knowledge/10-editorial-territories/`, e.g. "Argentine Cooking Techniques", "Family Memory") and the **idea library** (`knowledge/15-idea-library/`, one structured Markdown file per canonical article, e.g. `knowledge/15-idea-library/asado.md`). Ideas are channel-neutral editorial assets with stable IDs, a question, core insight, source article and review status. They are different from this repo's commercial **brand pillars** (`data/brand.json`, e.g. Product & Craft, Culture & Identity). Every content brief preserves its idea and canonical-article lineage while also receiving a brand pillar and editorial territory.

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

### 3a. Generate idea proposals from a canonical article

```bash
npm run generate:ideas -- <article-slug>
```

Reads the committed canonical article and asks Claude to propose 8–12 channel-neutral ideas. The proposal batch is stored in SQLite with the source article hash and Brand Brain commit. This command never modifies Brand Brain.

Brand Brain must have a clean Git working tree so the proposal can record a reproducible revision.

### 3b. Promote reviewed proposals explicitly

```bash
npm run ideas:promote -- <proposalId> [ideaId ...]
```

Promotes all pending ideas in a batch, or only the listed IDs, to the matching Brand Brain Idea Library. Promotion verifies that the canonical article has not changed since generation and writes each selected idea with `Status: review`.

### 3c. Review and approve canonical knowledge

Open `/brand-brain` from the dashboard. The review screen shows every canonical article alongside its Idea Library. Select the article and only the ideas you want to approve, then confirm the operation. Content Maker validates the selection, updates the Markdown files atomically and creates one local Git commit in Brand Brain. It never pushes that commit automatically.

Approvals require a clean Brand Brain working tree. If writing or committing fails, both Markdown files and the Git index are restored. Retired ideas cannot be approved from this workflow.

> **Idea generation and proposal promotion are CLI-only.** Canonical article and idea approval is available in the dashboard. Brief generation uses only committed articles and Idea Library entries whose status is `approved`.

### 4. Generate content briefs from the idea library

```bash
npm run generate:briefs -- --idea=<idea-id> [--idea=<idea-id> ...]
```

Generates briefs only for the explicitly selected, unused ideas with `Status: approved`. The dashboard presents those ideas grouped by article and supports individual or select-all choice. The old implicit first-five batch no longer exists. For each selection the generator reloads the corresponding canonical article, then asks Claude to create an abstract `ContentBrief`. With the current `claude.ai` Pro authentication this consumes the shared Claude Pro allowance, not separately billed Anthropic API usage. The brief is stored in SQLite and preserves the idea ID, source article ID/slug and exact Brand Brain commit. Generation refuses uncommitted Brand Brain changes and revalidates availability immediately before using Claude. No beats are created yet; this is not a video script and does not invoke OpenAI TTS.

### 5. Approve a content brief

```bash
npm run briefs:approve <id>      # or with no id, to list all briefs
```

Approving a `ContentBrief` marks a reusable editorial asset as ready for channel treatment. It can currently become one reel script and any number of alternative carousel treatments.

### 5a. Create a carousel treatment

Open an approved brief and choose **Crear carrusel**. The carousel inherits the brief's idea, article and exact Brand Brain revision. Claude designs structured slide operations using the visual tokens in `data/brand.json`; generated HTML is validated before an atomic SQLite update and Claude receives no Bash access. The editor supports iterative chat, aspect ratio, ordering, undo, approval and PNG/ZIP export. Exported ZIP artifacts are stored under `data/exports/carousels/` as well as downloaded by the browser.

### 6. Generate a reel script from an approved brief

```bash
npm run generate:script -- <contentBriefId>
```

Takes an *approved* `ContentBrief` and asks Claude to produce the beat-by-beat `ReelScript` (visual / voiceover / on-screen text per beat), stored in SQLite. This optionally reads the most recent trend report, but only for presentation-style enrichment — hook phrasing, pacing, CTA style. It never touches topic, which is already fixed by the brief; research improves how a script says something, never what it says.

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

Opens a dashboard at `localhost:3000`. **Brand Brain Review** (`/brand-brain`) approves canonical articles and selected ideas with an automatic local Git commit. The main dashboard runs research and presents all approved ideas that still lack a brief; choose specific ideas or select all and confirm generation with Claude Pro. It then groups **Briefs**, **Guiones** and **Carruseles**. An approved brief can create either channel treatment; carousel editing stays local and exports a ZIP, while reel publishing remains gated behind typing `publicar`. Idea generation and proposal promotion remain CLI-only. OpenAI API usage begins only when generating voiceover audio.

## Individual steps

Each pipeline stage is also its own command, in case you want to rerun just one:

```bash
npm run scrape:inspiration               # 1. scrape inspiration accounts
npm run generate:trend-report            # 2. build a trend report from the scrape
npm run generate:ideas -- <slug>         # 3a. article -> proposal batch in SQLite
npm run ideas:promote -- <batch> [ids]   # 3b. explicit proposal -> Brand Brain review entries
npm run generate:briefs -- --idea=<id>   # 4. selected idea(s) -> ContentBrief[]
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

All local and gitignored except explicit `.example` templates. Operational workflow state uses SQLite; generated snapshots and media remain files. Legacy brief/script/proposal JSON is imported without deletion by `npm run migrate:sqlite`.

```text
data/brand.json                  brand + commercial brand pillars (seeded by npm run setup)
data/content-maker.sqlite        idea proposals, ContentBriefs, ReelScripts and CarouselTreatments
data/inspiration-accounts.json   handles to scrape (see inspiration-accounts.example.json)
data/inspiration-reels/          scraped reel data per handle
data/trend-reports/<date>.json   trend report from generate:trend-report
data/voiceovers/<id>/            TTS audio per beat + timeline.json
data/edl/<id>.json               beat → footage/text-card mapping
data/exports/<id>.mp4            final rendered video
data/exports/carousels/<id>.zip  rendered carousel PNG bundle
footage/<id>/                    your real clips for a reel script (you provide these)
```

Outside this repo, in the Brand Brain repo:

```text
knowledge/20-articles/<slug>.md       canonical articles (input to generate:ideas and generate:briefs)
knowledge/15-idea-library/<slug>.md   structured, channel-neutral ideas per article (review → approved)
```

## Status

The full research/content-engine split described in `docs/decisions/2026-08-02-separate-research-from-content-creation.md` is implemented: Research Intelligence (scrape → trend report) and the Editorial Content Engine (idea library → content briefs → reel scripts or carousel treatments) run as separate stages, each with its own persistence and approval gate. Verified with real data/credentials, except the actual Graph API publish call — that step is gated behind typing `publicar` and hasn't been run for a real post yet.

What's left before this is fully in day-to-day use:

- **Real footage** — no clips exist yet, so every reel currently renders with text-card fallbacks. Drop clips into `footage/<reelScriptId>/` before `generate:edl` to use real video; sanity-check the AI-suggested trim points in `data/edl/<id>.json` before rendering, since Claude picks them from filenames/durations, not by watching the footage.
- **First real publish** — run `npm run publish:reel <reelScriptId>` yourself when a video is ready; nothing publishes automatically.
- **No background music yet** — no royalty-free tracks are wired in.
- **No caption/hashtag generation** — publish captions are just `hook + cta`; can be extended if you want fuller Instagram captions.
- **No feedback loop** — content briefs are grounded in the Brand Brain's idea library, never in inspiration-account performance (that's the whole point of the split — see the ADR); there's also no loop yet feeding Chef Rulo's own post history/insights back into idea or brief generation, even though the MCP tools for that are already wired up.
