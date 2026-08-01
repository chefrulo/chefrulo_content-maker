# chefrulo_content-maker

Local-first Instagram Reels pipeline for Chef Rulo & Family: research → brief → video → publish, orchestrated with Claude Code. Same philosophy as [Open Carrusel](https://github.com/Hainrixz/open-carrusel) — everything runs on your machine, Claude CLI as a subprocess agent, no data leaves except to the APIs each step actually needs.

## Setup

```bash
npm install
npm run setup
npm run doctor
```

Fill in `.env.local` (copied from `.env.example`) as each phase below needs it.

## Pipeline

### 1. Research + briefs

```bash
npm run pipeline:research
```

Scrapes recent reels from the accounts in `data/inspiration-accounts.json` (via Apify), then asks Claude to generate 5 reel briefs — one per content pillar in `data/brand.json` — grounded in what's working in those reels. Stops at a manual checkpoint: review the generated briefs under `data/briefs/`.

### 2. Approve a brief

```bash
npm run briefs:approve <briefId>      # or with no id, to list all briefs
```

### 3. Produce the video

```bash
npm run pipeline:produce <briefId>
```

Generates per-beat voiceover (OpenAI TTS), builds an EDL mapping beats to real footage in `footage/<briefId>/` (falls back to brand-styled text cards for beats without footage), and renders the final MP4 to `data/exports/<briefId>.mp4`. To use real footage: drop clips into `footage/<briefId>/` before this step.

### 4. Publish

```bash
npm run publish:reel <briefId>
```

Uploads the video to your VPS, creates the Reels container via the Instagram Graph API, and publishes. Requires typing `publicar` to confirm — this hits your real, public Instagram account.

## Individual steps

Each pipeline stage is also its own command, in case you want to rerun just one:

```bash
npm run scrape:inspiration
npm run generate:briefs
npm run generate:voiceover <briefId>
npm run generate:edl <briefId>
npm run render:reel <briefId>
```

## Claude Code + MCP

```bash
npm run claude              # interactive session, .mcp.json auto-loaded (approve the Instagram MCP server once)
npm run test:ig-insights    # non-interactive sanity check against your real IG account
```

## Data layout

All local, all gitignored except explicit `.example` templates:

```text
data/brand.json                  brand + content pillars (seeded by npm run setup)
data/inspiration-accounts.json   handles to scrape (see inspiration-accounts.example.json)
data/inspiration-reels/          scraped reel data per handle
data/briefs/                     generated reel briefs (pending_review → approved → published)
data/voiceovers/<id>/            TTS audio per beat + timeline.json
data/edl/<id>.json               beat → footage/text-card mapping
data/exports/<id>.mp4            final rendered video
footage/<id>/                    your real clips for a brief (you provide these)
```
