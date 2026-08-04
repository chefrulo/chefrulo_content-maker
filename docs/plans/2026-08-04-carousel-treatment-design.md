# Carousel Treatment design

> This document records the original design decisions. For the implemented
> runtime flow, exact Claude contract, validation rules and current
> limitations, see
> [`docs/architecture/carousel-generation.md`](../architecture/carousel-generation.md).

## Problem

Content Maker only produces one channel treatment from an approved
`ContentBrief`: a `ReelScript`. Carousels are currently made in a separate
app, Open Carrusel, which has no connection to Content Maker's Idea →
Content Brief pipeline — a carousel today starts from a blank chat, not
from an approved, brand-grounded idea.

Per the architecture audit
(`docs/audits/2026-08-04-brand-brain-content-maker-architecture-audit.md`),
the same `ContentBrief` should be able to produce multiple channel
treatments. Carousels are the first real test of that: if it works, the
"one idea, many channels" model is validated in practice, not just in
theory.

## Goal

Absorb Open Carrusel's carousel-creation capability (chat-driven slide
design + pixel-perfect PNG export) into Content Maker, seeded from an
approved `ContentBrief`, so Chef Rulo's carousels stop being disconnected
from the brand's approved editorial ideas — and Open Carrusel itself can
eventually be retired for this use case.

## Decisions

- **A carousel always originates from an approved `ContentBrief`.** No
  free-standing "create carousel from scratch" flow, unlike Open Carrusel
  today.
- **A brief can produce multiple carousels**, unlike `ReelScript` (which is
  capped at one per brief). Carousel creation is an iterative, exploratory
  chat process — a brief might reasonably get two different visual
  treatments tried before one is approved.
- **The export engine (Puppeteer + Sharp) is ported near-verbatim**, not
  reinvented. Remotion (already a dependency, used for reel video) isn't a
  substitute here — it's built for compositing React-defined frames into
  video, not screenshotting an arbitrary HTML/CSS string Claude just wrote.
- **Chat orchestration reuses `runClaudeAgent`** (`src/lib/claude-agent.ts`,
  already exists) — it already supports `allowedTools`, `sessionId` resume,
  and token streaming, which is everything Open Carrusel's chat route
  needs. No new orchestration primitive required.
- **Visual brand tokens (colors/fonts/logo) are new, additive config**, not
  a second source of truth. They don't exist anywhere in Content Maker or
  Brand Brain today. They live in Content Maker's `data/brand.json`
  (extended with a `visualDesign` section), matching the audit's own
  distinction that "colors and render typography" belong to Content Maker
  as technical/rendering config, not to Brand Brain as editorial
  knowledge. This is explicitly NOT the fix for the audit's separate P1
  finding about `data/brand.json` duplicating strategic brand info
  (positioning/pillars/tone) that arguably belongs in Brand Brain — that
  migration is out of scope here.
- **Direct Instagram publishing is out of scope for v1.** Open Carrusel
  itself doesn't publish either — it exports a ZIP for manual posting.
  Instagram's carousel publish API differs meaningfully from the reel
  publish flow already built (child media objects + a carousel container,
  vs. a single video upload), so this stays feature-parity with the source
  app rather than growing scope. A natural phase 2 later, not now.
- **Templates and Style Presets are deferred.** Open Carrusel has both;
  they're portable later without friction, but including them now would
  inflate the first cut.

## Data model

```ts
// src/types/carousel.ts
interface Slide {
  id: string;
  html: string;
  previousVersions: string[];
  order: number;
  notes: string;
}

interface CarouselTreatment {
  id: string;
  contentBriefId: string;
  createdAt: string;
  aspectRatio: "1:1" | "4:5" | "9:16";
  slides: Slide[];
  caption?: string;
  hashtags?: string[];
  chatSessionId: string | null;
  status: "draft" | "approved" | "rejected";
}
```

Persisted as `carousel_treatment` operational entities in `data/content-maker.sqlite`,
matching the hybrid-storage ADR. Rendered PNG/ZIP artifacts live under
`data/exports/carousels/`; canonical editorial knowledge remains in Brand Brain.

`ReelsBrand` (`src/types/brand.ts`) gets an additive `visualDesign` section:
palette (5 colors, matching Open Carrusel's primary/secondary/accent/
background/surface), heading/body font names, custom fonts, logo path,
style keywords.

## Ported modules (from `/home/eduardo/dev/open-carrusel`)

Near-verbatim, minimal adaptation:

- `src/lib/export-slides.ts` — Puppeteer singleton browser, per-slide
  screenshot at exact Instagram dimensions, batched 3-at-a-time, zipped via
  `archiver`.
- `src/lib/slide-html.ts` — `wrapSlideHtml()`, the shared rendering
  contract used by both the live iframe preview and the PNG export, so
  preview and export are pixel-identical.
- `src/lib/fonts.ts` — Google Fonts CSS2 fetch, woff2 download, base64
  inlining, disk-cached at `data/.font-cache/`.
- UI components: `SlideRenderer` (sandboxed iframe preview), `SlideFilmstrip`
  (drag-reorder via `@dnd-kit`), `AspectRatioSelector`, `SafeZoneOverlay`,
  `ExportButton`.

New dependencies: `puppeteer`, `sharp`, `archiver`, `@dnd-kit/core`,
`@dnd-kit/sortable`. (`async-mutex`, `cross-spawn` already present.)

## Chat/generation flow

1. On an approved `content-briefs/[id]` page, a "Crear carrusel" button
   (always available, not gated to one-per-brief) does
   `POST /api/content-briefs/[id]/carousels`, creating an empty
   `CarouselTreatment`, and navigates to `/carousels/[id]`.
2. The chat system prompt (adapted from Open Carrusel's
   `chat-system-prompt.ts`) is seeded with: the brief's `hook`,
   `coreMessage`, `culturalInsight`, `personalStory`, `educationalValue`,
   `cta`; the brand's `visualDesign` tokens; and the Brand Brain foundation
   (voice, guardrails) the same way `generate-script.ts` already includes
   it — so a carousel can't drift off-brand just because it's a visual
   medium instead of a spoken one.
3. Claude returns validated structured slide operations (`add`, `update`,
   `delete`). Content Maker applies the complete operation batch atomically.
   Claude does not receive Bash access, reducing capability without reducing
   the editor's creative workflow.
4. `POST /api/carousels/[id]/chat` streams the response as SSE (same
   pattern `PipelineRunner` already uses for streamed steps, just consumed
   by a chat panel instead of a progress bar).
5. Editor UI at `/carousels/[id]`: chat panel (left) + iframe preview
   (center, via `wrapSlideHtml`) + slide filmstrip (bottom, drag-reorder) —
   ported layout from Open Carrusel's `carousel/[id]/page.tsx`.

## Dashboard integration

- Root dashboard (`src/app/page.tsx`): a third status-grouped section,
  "Carruseles", alongside the existing "Briefs" and "Guiones" — same card
  grid pattern. `CarouselCard` stays simple (badges + hook + territory), no
  live thumbnail — the real preview lives inside the editor.
- `content-briefs/[id]/page.tsx`: lists all carousels generated from that
  brief (can be more than one), with "Crear otro carrusel" always available
  while the brief is approved.
- `/carousels/[id]`: Aprobar/Rechazar buttons (same review discipline as
  briefs/scripts) plus an "Exportar (ZIP)" button.

## Open Carrusel's fate

Not deleted, not modified. It remains its own tool. Once this ships and is
validated with real Chef Rulo content, Eduardo can simply stop using it for
this brand — that's an operational call to make later, not a technical one
to force now.

## Out of scope (this round)

- Direct Instagram carousel publishing.
- Templates and Style Presets (portable later, not now).
- Migrating `data/brand.json`'s strategic fields (positioning/pillars/tone)
  to Brand Brain — separate, already-identified follow-up from the audit.
- Live thumbnail previews on the dashboard card grid.
