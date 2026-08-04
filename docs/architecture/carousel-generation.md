# Carousel generation architecture

This document describes the carousel pipeline as it is implemented today. It
is the operational reference for understanding where carousel content comes
from, what Claude receives, what Claude is allowed to produce, and how the
result becomes an exportable asset.

## Responsibility boundary

A carousel is a channel treatment of an approved `ContentBrief`. It is not a
new editorial idea and it cannot be created from an unapproved brief.

```text
Brand Brain article
        ↓
channel-neutral idea
        ↓
approved ContentBrief
        ↓
CarouselTreatment
        ↓
Claude slide operations
        ↓
validated HTML/CSS slides in SQLite
        ↓
PNG files packaged as ZIP
```

The responsibilities are intentionally separated:

- **Brand Brain** owns canonical articles, editorial ideas, voice and
  guardrails.
- **ContentBrief** fixes the approved message: hook, core message, cultural
  insight, personal story, educational value and CTA.
- **Claude** acts as the carousel treatment designer. It chooses the visual
  sequence, hierarchy, layout and wording within the approved brief.
- **Content Maker** owns provenance, prompt assembly, validation, persistence,
  versioning, approval and export.

Claude does not receive Bash, database or repository access during carousel
generation. It can only propose structured operations for Content Maker to
validate and apply.

## Starting a carousel

From an approved brief, `POST /api/content-briefs/[id]/carousels` creates an
empty `CarouselTreatment` and copies its editorial lineage:

- content brief ID;
- idea ID;
- source article ID and slug;
- exact Brand Brain Git revision;
- hook and editorial territory.

The default aspect ratio is `4:5`, the initial status is `draft`, and the
carousel starts without slides or a Claude session. A brief can have multiple
carousel treatments so alternative creative directions can be explored.

## Prompt construction

Every chat request has two inputs.

### User instruction

The initial editor action sends:

```text
Creá un carrusel completo de 7 slides a partir del brief aprobado.
```

Later requests contain the instruction typed in the editor, for example
"Reducí el texto del slide 3" or "Hacé la portada más minimalista".

### System prompt

`buildCarouselSystemPrompt()` assembles the controlled context Claude needs:

1. The Editorial Foundation loaded from the exact Brand Brain revision stored
   on the brief. This preserves historical reproducibility if Brand Brain
   changes later.
2. The approved brief fields: hook, core message, cultural insight, optional
   personal story, educational value and CTA.
3. The rendering canvas and the brand's visual tokens: palette, heading font,
   body font and style keywords.
4. Every current slide, including its stable ID, notes and complete HTML.

The prompt tells Claude not to change approved claims or invent personal
memories. It also requires:

- JSON only, without Markdown fences;
- at most ten operations in one response;
- body-level HTML with inline CSS;
- no JavaScript, external scripts, `<html>`, `<head>` or `<body>` wrappers;
- one main idea per slide;
- clear hierarchy, strong contrast and safe padding;
- a consistent language throughout the carousel;
- for the initial treatment, six to eight slides progressing from hook through
  context and insight to summary and CTA;
- for revisions, updates to existing slide IDs instead of unnecessary
  duplicates.

The visual configuration guides Claude; it does not replace the editorial
constraints inherited from Brand Brain and the brief.

## Claude response contract

Claude must return one JSON object:

```json
{
  "message": "Creé un recorrido editorial de siete slides.",
  "operations": [
    {
      "type": "add",
      "html": "<section style=\"...\">...</section>",
      "notes": "Portada y hook"
    },
    {
      "type": "update",
      "slideId": "existing-slide-id",
      "html": "<section style=\"...\">...</section>",
      "notes": "Jerarquía simplificada"
    },
    {
      "type": "delete",
      "slideId": "another-slide-id"
    }
  ],
  "caption": "Caption opcional para Instagram",
  "hashtags": ["asado", "cultura", "chefrulo"]
}
```

Supported operations are:

- `add`: append a new slide with a generated stable ID;
- `update`: replace an existing slide while preserving its previous HTML;
- `delete`: remove an existing slide.

The parser tolerates an accidental JSON Markdown fence, but the prompt
explicitly forbids one. A response without a message or operation array is
rejected.

## Request and session lifecycle

`POST /api/carousels/[id]/chat` performs the following sequence:

1. Validates same-origin access and a user message between 1 and 10,000
   characters.
2. Loads the carousel, associated brief, visual brand configuration and the
   Editorial Foundation at the recorded Brand Brain revision.
3. Calls Claude Code with the user instruction and assembled system prompt.
4. Resumes `chatSessionId` when one exists, allowing Claude to retain the
   creative conversation across requests.
5. Parses the structured result and applies the complete operation batch.
6. Streams status, result and completion events to the editor using SSE.

This is event streaming for request status and the completed result, not
token-by-token display of Claude's response.

`maxBudgetUsd: 1` is a defensive ceiling passed to the Claude Code process. In
the current local setup, Claude uses the user's Claude Pro authentication; the
value is not a one-dollar charge per carousel.

## Validation and atomic persistence

Slides are HTML/CSS documents generated for rendering, so they are treated as
untrusted input. Content Maker rejects slide HTML that:

- is empty or larger than 120 KB;
- contains `<html>`, `<head>`, `<body>`, `<script>`, `<iframe>`, `<object>` or
  `<embed>`;
- contains inline event handlers such as `onclick`;
- contains a `javascript:` URL.

The operation batch is applied to an in-memory copy first and saved to SQLite
only after every operation passes. Therefore one invalid operation cannot
leave a partially modified carousel.

Additional constraints include:

- a maximum caption length of 2,200 characters;
- a maximum of 30 hashtags;
- a maximum of five previous HTML versions per updated slide;
- automatic slide renumbering after add, delete or reorder;
- any content modification returns the carousel to `draft` for review.

## Rendering and export

Each slide is stored as body-level HTML with inline styles. The live editor
wraps it in the same rendering document used by export and displays it inside
a sandboxed iframe.

Export uses the browser as the rendering engine:

1. Puppeteer renders each slide at the exact dimensions of `1:1`, `4:5` or
   `9:16`.
2. Each rendered slide is captured as a PNG and processed with Sharp.
3. Archiver packages the ordered PNG files into a ZIP.
4. The ZIP is stored under `data/exports/carousels/<carousel-id>.zip` and is
   also returned for browser download.

This makes the preview and exported image follow the same HTML/CSS rendering
contract. Claude currently creates typographic and CSS-based visual designs;
the pipeline does not generate photographs or illustrations.

## Review model

Carousel treatments have three states: `draft`, `approved` and `rejected`.
Approval is a deliberate editorial gate after visual generation. Editing an
approved or rejected carousel makes it a draft again so the changed result
must be reviewed.

## Current limitations

- Visible chat messages live in the editor's client state and disappear after
  a page refresh. The Claude session ID remains persisted for model continuity.
- There is no image-generation or reference-image workflow.
- There are no reusable templates or named style presets yet.
- Export is ZIP-only; direct Instagram carousel publishing is not implemented.
- Claude returns the whole structured response before operations are applied;
  individual response tokens are not shown live.

## Relevant implementation files

- `src/lib/carousel-chat.ts`: system prompt and response parsing.
- `src/app/api/carousels/[id]/chat/route.ts`: request orchestration and SSE.
- `src/lib/carousels.ts`: lifecycle, validation, operations and persistence.
- `src/lib/slide-html.ts`: shared preview/export HTML wrapper.
- `src/lib/export-carousel.ts`: PNG rendering and ZIP creation.
- `src/app/carousels/[id]/page.tsx`: carousel editor and user instructions.
- `src/types/carousel.ts`: persisted carousel and slide contracts.

