# Printable shot list (PDF) design

## Problem

There's no way to take a brief's beats to a shoot on paper. The brief detail
page is the only place the `visual`/`voiceover` per beat lives, and it's not
formatted for reading while filming.

## Goals

- A downloadable PDF shot list per brief: what to film per beat, and what's
  said (so it doubles as a script if recording voice on-location).
- Reusable approach — this is the first of what will likely be several
  printable outputs later, so pick a mechanism that isn't a one-off hack
  around browser print quirks.

## Decision: `@react-pdf/renderer`, not browser print / not Puppeteer

Browser print (`@media print` + `Ctrl+P`) was considered and rejected: fine
for a single one-off page, but fidelity varies by browser/OS print driver,
and it doesn't generalize to "generate this file well" for future printable
outputs.

Puppeteer (headless Chrome to `page.pdf()`) was considered and rejected: the
project already carries Remotion's Chromium dependency for video rendering;
adding a second heavy browser dependency just to lay out text is redundant
weight for what's fundamentally a one-page text document.

`@react-pdf/renderer` renders PDF from React components (`<Document>`,
`<Page>`, `<Text>`, `<View>`) directly to a buffer, no browser involved.
Pure JS, one new dependency, and the component model is the same shape as
everything else in this Next.js app, which makes future printable outputs
(labels, footage checklists, whatever comes next) a matter of writing more
components against the same renderer rather than solving PDF generation
again.

## Design

### Route

`GET /api/briefs/[id]/shotlist` — builds the PDF server-side with
`@react-pdf/renderer`'s `renderToBuffer`, returns it with
`Content-Type: application/pdf`. No caching/persistence to disk — cheap
enough to regenerate on every request, and it should always reflect the
brief's current beats.

### Content

Per the chosen scope (visual + voiceover, not the full brief):

- **Header**: `hook` and `topic`, so the sheet is identifiable without going
  back to the dashboard.
- **Per beat**: beat number, `visual` in bold (what to film), `voiceover` in
  quotes below it if present (what's said), estimated duration in the
  margin. Beats with no `voiceover` just show the visual — no empty
  placeholder line.
- Explicitly excluded: `onScreenText`, CTA, brand colors/logo — this is a
  shoot-day tool, not a branded document. Optimized for fast reading on
  paper, not aesthetics.

### Entry point

A "Descargar PDF" link on `src/app/briefs/[id]/page.tsx`, next to
Aprobar/Rechazar: plain `<a href="/api/briefs/{id}/shotlist" target="_blank">`.
No client-side JS needed — the browser handles the download/preview itself.

## Out of scope

- Page numbers, brand styling, logo.
- Any content beyond visual + voiceover (onScreenText, CTA, hook explanation
  beyond the header, brand pillar/territory tags).
- Persisting generated PDFs to disk — always generated fresh from the
  current brief.
