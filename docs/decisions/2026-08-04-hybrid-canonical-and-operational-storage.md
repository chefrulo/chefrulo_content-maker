# Architecture Decision: Hybrid Canonical and Operational Storage

## Status

Accepted and implemented.

## Decision

Chef Rulo uses different storage systems for different lifecycles:

- Brand Brain Markdown in Git is the canonical source for durable editorial knowledge.
- SQLite is the source for local operational workflow state.
- The filesystem stores generated media and immutable research artefacts.
- Search indexes and future embeddings are derived views that must be rebuildable from canonical sources.

## Canonical knowledge

Git owns:

- Foundation and editorial policy.
- Editorial territories.
- Canonical articles.
- Approved or reviewable Idea Library entries.
- Editorial patterns.
- Source and asset metadata.

Content Maker reads this repository through `BrandBrainGateway`. Generating ideas does not write to Brand Brain. It creates an operational proposal batch. Only the explicit `ideas:promote` command may add selected proposals to an Idea Library file, and promoted entries still begin in `review`.

Every generated Content Brief records the exact Brand Brain commit. Generation refuses a dirty Brand Brain working tree because an uncommitted source cannot be reproduced from its Git revision.

## Operational state

SQLite owns:

- Idea proposal batches.
- Content Briefs.
- Reel Scripts.
- Their current workflow status.

The database lives at `data/content-maker.sqlite`. SQLite uses WAL mode and a single table with typed entities stored as JSON payloads plus indexed identity, status and timestamps. Repository interfaces isolate callers from the storage implementation.

Legacy JSON under `data/content-briefs/`, `data/reel-scripts/` and `data/idea-proposals/` is imported with `INSERT OR IGNORE`. Existing files are never deleted or overwritten by migration, and newer SQLite state wins.

## Filesystem artefacts

The following remain files because they are generated snapshots or media artefacts rather than mutable workflow records:

- Inspiration scrapes and trend reports.
- Voiceover audio and timelines.
- EDL files.
- Footage and recorded voice clips.
- Rendered exports.

Large original media should eventually live in object storage. Brand Brain stores only its metadata, rights, checksum and durable reference.

## Consequences

- Editorial knowledge stays human-readable, diffable and versioned.
- Operational writes no longer create noisy Git history.
- A brief can be traced to a committed knowledge snapshot.
- Content Maker can later move from SQLite to PostgreSQL without changing Brand Brain.
- SQLite remains local-first and is not intended for simultaneous direct access from multiple machines.
