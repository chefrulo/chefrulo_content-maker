# Design: separate research from content creation

Implements the decision in `docs/decisions/2026-08-02-separate-research-from-content-creation.md`.

## New pipeline

```
Research Intelligence (independent, never touches content)
  scrape:inspiration  -> data/inspiration-reels/
  generate:trend-report -> data/trend-reports/<date>.json

Editorial Content Engine (never starts from scraped reels)
  generate:ideas <article-slug>  -> brand-brain: knowledge/15-idea-library/<slug>.md
  generate:briefs                -> data/content-briefs/<id>.json   (ContentBrief, abstract)
  [approve content brief in dashboard]
  generate:script <contentBriefId> -> data/reel-scripts/<id>.json   (ReelScript, has beats)
  [approve script in dashboard]
  pipeline:produce <id>           -> unchanged (voiceover, EDL, render)
  publish:reel <id>               -> unchanged
```

## New/changed types

`src/types/content-brief.ts` (new):

```ts
export interface ContentBrief {
  id: string;
  ideaId: string;      // stable hash of the idea text, see below
  ideaText: string;
  brandPillar: string;
  editorialTerritory: string;
  hook: string;
  coreMessage: string;
  culturalInsight: string;
  personalStory?: string;   // only if grounded in a real documented story — never invented
  educationalValue: string;
  cta: string;
  status: "pending_review" | "approved" | "rejected";
  createdAt: string;
}
```

`src/types/reel-script.ts` (renamed from `src/types/brief.ts`, `ReelBrief` -> `ReelScript`,
`ReelBeat` unchanged): same fields as today's `ReelBrief`, plus `contentBriefId: string`
linking back to the approved `ContentBrief` it was generated from.

Idea identity: since ideas live as markdown bullets with no stable id, `ideaId` is
`sha1(articleSlug + "::" + ideaText).slice(0, 12)`. Stable as long as the idea's
wording doesn't change; editing an idea's text in the Brand Brain effectively
makes it a new idea, which is acceptable.

## Storage layout

```
chef-rulo-brand-brain/
  knowledge/20-articles/<slug>.md        canonical article (existing)
  knowledge/15-idea-library/<slug>.md    permanent idea list (NEW)

chefrulo_content-maker/
  data/trend-reports/<iso-date>.json     market intelligence snapshot (NEW)
  data/content-briefs/<id>.json          ContentBrief (NEW, replaces nothing)
  data/reel-scripts/<id>.json            ReelScript (renamed from data/briefs/)
  data/voiceovers/, data/edl/, data/exports/   unchanged
```

## Scripts

- `scrape-inspiration.ts` — unchanged.
- `generate-trend-report.ts` (new) — reads all `data/inspiration-reels/*.json`,
  one Claude call, purely descriptive/analytical prompt (hook patterns, avg
  duration, CTA styles, emotional patterns, posting frequency, saturated
  topics, emerging opportunities). Writes `data/trend-reports/<date>.json`.
  Never mentions Chef Rulo or generates any content-shaped output.
- `pipeline-research.ts` — trimmed to `scrape:inspiration` + `generate:trend-report`
  only. Checkpoint message changes from "N briefs pending approval" to
  "trend report saved to data/trend-reports/<date>.json".
- `generate-ideas.ts` (new) — `npm run generate:ideas -- <article-slug>`.
  Reads `knowledge/20-articles/<slug>.md` from `BRAND_BRAIN_PATH` (required,
  hard error if unset — there's no meaningful idea generation without the
  brand brain). Claude call asks for 8-12 ideas in the article's territory,
  written as questions (matching the existing gold-standard examples style).
  Appends new ideas to `knowledge/15-idea-library/<slug>.md` (creates file
  if missing), deduplicated by exact text match against existing lines.
  Prints the new ideas so they can be reviewed/edited by hand immediately.
- `generate-briefs.ts` (rewritten) — no longer touches
  `data/inspiration-reels/` at all. Reads every
  `knowledge/15-idea-library/*.md` file, computes `ideaId` for each bullet,
  filters out ideas that already have a `ContentBrief` (scans
  `data/content-briefs/*.json` for matching `ideaId`), takes the next 5
  unused ideas rotating brand pillars (same `BRIEFS_PER_RUN` pattern as
  today), and for each calls Claude with **only** Brand Brain foundation +
  approved reel examples + the idea text — explicitly no trend report, no
  scraped reels — producing the abstract `ContentBrief` fields. Requires
  `BRAND_BRAIN_PATH`; hard error if unset (no degraded mode — the brand
  brain is the only source of ideation now, so there's nothing sensible to
  generate without it).
- `generate-script.ts` (new — this is today's beat-generation logic, moved
  and retargeted) — `npm run generate:script -- <contentBriefId>`. Requires
  the `ContentBrief` to be `status: "approved"`. Prompt inputs: Brand Brain
  foundation, approved reel examples, the approved `ContentBrief` fields,
  and — if present — the most recent `data/trend-reports/<date>.json`,
  explicitly framed as informing **presentation only** (hook phrasing
  style, pacing, typical duration, CTA phrasing trends), never topic
  (already fixed by the brief). Trend report is optional, same graceful
  fallback as brand brain has today. Produces the beats array, writes
  `data/reel-scripts/<id>.json` with `status: "pending_review"` and
  `contentBriefId` set.
- `approve-brief.ts` — split into `approve-content-brief.ts` (operates on
  `data/content-briefs/`) and keeps working the same way for
  `data/reel-scripts/` (renamed, same logic).

## API routes and dashboard

- New: `src/app/api/content-briefs/`, mirroring `src/app/api/briefs/`
  (list, `[id]`, `[id]/approve`, `[id]/reject`). No produce/publish routes
  for content briefs — those stay on reel scripts.
- Renamed: `src/app/api/briefs/` -> `src/app/api/scripts/`,
  `src/app/briefs/[id]/page.tsx` -> `src/app/scripts/[id]/page.tsx`.
- New: `src/app/content-briefs/[id]/page.tsx` — same shape as the script
  detail page minus the beats/produce/publish sections: shows hook, core
  message, cultural insight, personal story (if any), educational value,
  CTA, approve/reject buttons. Once approved, shows a "Generar guion"
  button that streams `generate:script` (reusing `PipelineRunner`).
- Root dashboard (`src/app/page.tsx`): two grouped-by-status sections
  stacked — "Briefs" (ContentBrief cards) above "Scripts" (ReelScript
  cards, today's `BriefCard` reused/generalized). The single "Correr
  research + generar briefs" button splits into "Correr research" (scrape +
  trend report) and "Generar briefs" (Idea Library -> Content Briefs).

## Out of scope / explicit non-goals

- No migration of existing `data/briefs/*.json` test data — `data/` is
  local and gitignored, those files are simply orphaned going forward.
- Script and Storyboard stay fused as today's beats structure (visual +
  voiceover + onScreenText together) — no separate review screen for each.
- No UI for hand-picking which idea becomes a brief — selection is
  automatic (oldest unused ideas, rotating pillars), matching today's
  `generate:briefs` selection pattern.
- No changes to `pipeline:produce`, `publish:reel`, voiceover/EDL/render —
  those already consume a beats-shaped script and don't care where it came
  from.
