# chefrulo_content-maker

Local-first Instagram Reels pipeline for Chef Rulo & Family: research → brief → video → publish, orchestrated with Claude Code. Same philosophy as [Open Carrusel](https://github.com/Hainrixz/open-carrusel) — everything runs on your machine, Claude CLI as a subprocess agent, no data leaves except to the APIs each step actually needs.

## Requirements

- Node 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [`cloudflared`](https://github.com/cloudflare/cloudflared) on PATH — only needed for Phase 6 (publish)
- Accounts/tokens: Meta (Instagram Graph API), Apify, OpenAI — `npm run doctor` tells you what's missing

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

No VPS involved: the Graph API needs a public HTTPS URL to fetch the video from, so this spins up a local HTTP server plus a [cloudflared](https://github.com/cloudflare/cloudflared) quick tunnel (no account/signup needed) just long enough for Meta's servers to download it, then tears both down. Requires `cloudflared` on PATH (`npm run doctor` checks for it). Requires typing `publicar` to confirm — this hits your real, public Instagram account.

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

## Status

All 7 phases from the original plan are built and were verified with real data/credentials, except the actual Graph API publish call — that step is gated behind typing `publicar` and hasn't been run for a real post yet.

What's left before this is fully in day-to-day use:

- **Real footage** — no clips exist yet, so every brief currently renders with text-card fallbacks. Drop clips into `footage/<briefId>/` before `generate:edl` to use real video; sanity-check the AI-suggested trim points in `data/edl/<id>.json` before rendering, since Claude picks them from filenames/durations, not by watching the footage.
- **First real publish** — run `npm run publish:reel <briefId>` yourself when a video is ready; nothing publishes automatically.
- **No background music yet** — no royalty-free tracks are wired in.
- **No caption/hashtag generation** — publish captions are just `hook + cta`; can be extended if you want fuller Instagram captions.
- **No feedback loop** — Phase 4 briefs are grounded in inspiration-account performance (Phase 3), not in Chef Rulo's own post history/insights (Phase 2), even though the MCP tools for that are already wired up.
