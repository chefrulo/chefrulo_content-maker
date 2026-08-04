import test from "node:test";
import assert from "node:assert/strict";
import type { LibraryIdea } from "../src/lib/idea-library.ts";
import {
  parseRequestedIdeaArgs,
  selectRequestedIdeas,
  validateRequestedIdeaIds,
} from "../src/lib/brief-idea-selection.ts";

function idea(ideaId: string): LibraryIdea {
  return {
    ideaId,
    title: ideaId,
    ideaText: `Question for ${ideaId}`,
    coreInsight: `Insight for ${ideaId}`,
    status: "approved",
    signatureIdea: false,
    sourceArticleId: "article-asado",
    articleSlug: "asado",
  };
}

test("explicit idea arguments preserve the user's requested order", () => {
  const requested = parseRequestedIdeaArgs([
    "--idea=idea-asado-002",
    "--idea=idea-asado-001",
  ]);
  const selected = selectRequestedIdeas(
    [idea("idea-asado-001"), idea("idea-asado-002")],
    requested
  );

  assert.deepEqual(selected.map((item) => item.ideaId), ["idea-asado-002", "idea-asado-001"]);
});

test("brief generation requires a non-empty unique selection", () => {
  assert.throws(() => validateRequestedIdeaIds([]), /al menos una idea/);
  assert.throws(
    () => validateRequestedIdeaIds(["idea-asado-001", "idea-asado-001"]),
    /duplicados/
  );
  assert.throws(() => validateRequestedIdeaIds(["../../secret"]), /inválidos/);
});

test("ideas that are no longer approved or available are rejected", () => {
  assert.throws(
    () => selectRequestedIdeas([idea("idea-asado-001")], ["idea-asado-002"]),
    /ya no están disponibles/
  );
});
