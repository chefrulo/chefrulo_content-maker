import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentBriefRepository } from "../src/repositories/operational-repository.ts";
import {
  addSlide,
  applyCarouselOperations,
  createCarouselFromBrief,
  getCarousel,
  undoSlide,
  updateSlide,
  validateSlideHtml,
} from "../src/lib/carousels.ts";
import type { ContentBrief } from "../src/types/content-brief.ts";

const brief: ContentBrief = {
  id: "brief-carousel-test",
  ideaId: "idea-asado-001",
  ideaText: "Why does the fire come first?",
  sourceArticleId: "article-asado",
  sourceArticleSlug: "asado",
  brandBrainRevision: "a".repeat(40),
  brandPillar: "Culture & Identity",
  editorialTerritory: "fire-and-grilling",
  hook: "The fire is the first guest",
  coreMessage: "The gathering begins when the fire is lit.",
  culturalInsight: "Waiting beside the fire is part of the asado.",
  educationalValue: "Understand fire as social structure.",
  cta: "Who gathers around your fire?",
  status: "approved",
  createdAt: new Date(0).toISOString(),
};

test("carousel treatment preserves brief provenance and slide history", async () => {
  process.env.CONTENT_MAKER_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "carousel-test-"));
  await contentBriefRepository.save(brief);
  const carousel = await createCarouselFromBrief(brief.id);
  assert.equal(carousel.ideaId, brief.ideaId);
  assert.equal(carousel.brandBrainRevision, brief.brandBrainRevision);

  const slide = await addSlide(carousel.id, '<section style="width:1080px;height:1350px">Fire</section>', "hook");
  await updateSlide(carousel.id, slide.id, '<section style="width:1080px;height:1350px">The fire</section>');
  assert.equal((await getCarousel(carousel.id)).slides[0]?.previousVersions.length, 1);
  await undoSlide(carousel.id, slide.id);
  assert.match((await getCarousel(carousel.id)).slides[0]?.html ?? "", />Fire</);
});

test("structured operations are atomic and executable HTML is rejected", async () => {
  process.env.CONTENT_MAKER_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "carousel-test-"));
  await contentBriefRepository.save({ ...brief, id: "brief-carousel-atomic" });
  const carousel = await createCarouselFromBrief("brief-carousel-atomic");

  await assert.rejects(
    () => applyCarouselOperations(carousel.id, [
      { type: "add", html: "<section>Valid</section>" },
      { type: "add", html: "<script>alert(1)</script>" },
    ]),
    /forbidden element/
  );
  assert.equal((await getCarousel(carousel.id)).slides.length, 0);
  assert.throws(() => validateSlideHtml('<div onclick="alert(1)">Bad</div>'), /executable code/);
});

test("a carousel cannot originate from an unapproved brief", async () => {
  process.env.CONTENT_MAKER_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "carousel-test-"));
  await contentBriefRepository.save({ ...brief, id: "brief-carousel-review", status: "pending_review" });
  await assert.rejects(() => createCarouselFromBrief("brief-carousel-review"), /approved Content Brief/);
});
