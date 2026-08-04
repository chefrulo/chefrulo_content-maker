import test from "node:test";
import assert from "node:assert/strict";
import { parseIdeasFromMarkdown } from "../src/lib/idea-library.ts";

test("structured ideas preserve stable identity and provenance", () => {
  const markdown = `# Asado ideas

## idea-asado-fire — The fire comes first

**Status:** approved
**Signature idea:** yes
**Question:** Why does the fire come first?
**Core insight:** The fire establishes the gathering before food is served.
**Why it matters:** It connects technique and hospitality.
**Source article:** article-asado
`;

  assert.deepEqual(parseIdeasFromMarkdown("asado", markdown), [
    {
      ideaId: "idea-asado-fire",
      title: "The fire comes first",
      ideaText: "Why does the fire come first?",
      coreInsight: "The fire establishes the gathering before food is served.",
      whyItMatters: "It connects technique and hospitality.",
      status: "approved",
      signatureIdea: true,
      sourceArticleId: "article-asado",
      articleSlug: "asado",
    },
  ]);
});

test("invalid editorial status is rejected", () => {
  const markdown = `## idea-asado-fire — Fire

**Status:** published
**Question:** Why fire?
**Core insight:** It creates heat.
**Source article:** article-asado
`;
  assert.throws(
    () => parseIdeasFromMarkdown("asado", markdown),
    /Status must be draft, review, approved or retired/
  );
});
