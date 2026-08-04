import { randomUUID } from "node:crypto";
import { Mutex } from "async-mutex";
import { carouselTreatmentRepository, contentBriefRepository } from "@/repositories/operational-repository";
import type { CarouselSlide, CarouselTreatment } from "@/types/carousel";
import { MAX_CAROUSEL_SLIDES, MAX_SLIDE_VERSIONS } from "@/types/carousel";

const carouselMutex = new Mutex();
const SAFE_ID = /^[a-zA-Z0-9-]+$/;

export function validateSlideHtml(html: unknown): string {
  if (typeof html !== "string" || html.trim().length === 0) throw new Error("Slide HTML is required");
  if (html.length > 120_000) throw new Error("Slide HTML exceeds 120 KB");
  if (/<\/?(?:html|head|body|script|iframe|object|embed)\b/i.test(html)) {
    throw new Error("Slide HTML contains a forbidden element");
  }
  if (/\bon[a-z]+\s*=|javascript:/i.test(html)) throw new Error("Slide HTML contains executable code");
  return html.trim();
}

export async function listCarousels(): Promise<CarouselTreatment[]> {
  return carouselTreatmentRepository.list();
}

export async function getCarousel(id: string): Promise<CarouselTreatment> {
  return carouselTreatmentRepository.get(id);
}

export async function createCarouselFromBrief(contentBriefId: string): Promise<CarouselTreatment> {
  const brief = await contentBriefRepository.get(contentBriefId);
  if (brief.status !== "approved") throw new Error("Only an approved Content Brief can create a carousel");
  const now = new Date().toISOString();
  const carousel: CarouselTreatment = {
    id: randomUUID(),
    contentBriefId: brief.id,
    ideaId: brief.ideaId,
    sourceArticleId: brief.sourceArticleId,
    sourceArticleSlug: brief.sourceArticleSlug,
    brandBrainRevision: brief.brandBrainRevision,
    name: brief.hook,
    hook: brief.hook,
    editorialTerritory: brief.editorialTerritory,
    createdAt: now,
    updatedAt: now,
    aspectRatio: "4:5",
    slides: [],
    chatSessionId: null,
    status: "draft",
  };
  await carouselTreatmentRepository.save(carousel);
  return carousel;
}

export async function listCarouselsForBrief(contentBriefId: string): Promise<CarouselTreatment[]> {
  return (await carouselTreatmentRepository.list()).filter((item) => item.contentBriefId === contentBriefId);
}

export async function updateCarousel(
  id: string,
  updates: Partial<Pick<CarouselTreatment, "aspectRatio" | "caption" | "hashtags" | "chatSessionId" | "status">>
): Promise<CarouselTreatment> {
  return carouselMutex.runExclusive(async () => {
    const carousel = await getCarousel(id);
    Object.assign(carousel, updates, { updatedAt: new Date().toISOString() });
    await carouselTreatmentRepository.save(carousel);
    return carousel;
  });
}

export async function addSlide(id: string, html: unknown, notes = ""): Promise<CarouselSlide> {
  return carouselMutex.runExclusive(async () => {
    const carousel = await getCarousel(id);
    if (carousel.slides.length >= MAX_CAROUSEL_SLIDES) throw new Error("Maximum slide count reached");
    const slide: CarouselSlide = {
      id: randomUUID(), html: validateSlideHtml(html), previousVersions: [],
      order: carousel.slides.length, notes: typeof notes === "string" ? notes.slice(0, 500) : "",
    };
    carousel.slides.push(slide);
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
    return slide;
  });
}

export async function updateSlide(carouselId: string, slideId: string, html: unknown, notes?: string): Promise<CarouselSlide> {
  return carouselMutex.runExclusive(async () => {
    const carousel = await getCarousel(carouselId);
    const slide = carousel.slides.find((item) => item.id === slideId);
    if (!slide) throw new Error("Slide not found");
    const nextHtml = validateSlideHtml(html);
    if (nextHtml !== slide.html) {
      slide.previousVersions.push(slide.html);
      slide.previousVersions = slide.previousVersions.slice(-MAX_SLIDE_VERSIONS);
      slide.html = nextHtml;
    }
    if (typeof notes === "string") slide.notes = notes.slice(0, 500);
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
    return slide;
  });
}

export async function deleteSlide(carouselId: string, slideId: string): Promise<void> {
  return carouselMutex.runExclusive(async () => {
    const carousel = await getCarousel(carouselId);
    const next = carousel.slides.filter((slide) => slide.id !== slideId);
    if (next.length === carousel.slides.length) throw new Error("Slide not found");
    carousel.slides = next.map((slide, order) => ({ ...slide, order }));
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
  });
}

export async function reorderSlides(carouselId: string, slideIds: unknown): Promise<CarouselSlide[]> {
  return carouselMutex.runExclusive(async () => {
    if (!Array.isArray(slideIds) || !slideIds.every((id) => typeof id === "string" && SAFE_ID.test(id))) {
      throw new Error("A valid slideIds array is required");
    }
    const carousel = await getCarousel(carouselId);
    if (slideIds.length !== carousel.slides.length || new Set(slideIds).size !== slideIds.length) {
      throw new Error("slideIds must contain every slide exactly once");
    }
    const byId = new Map(carousel.slides.map((slide) => [slide.id, slide]));
    carousel.slides = slideIds.map((id, order) => {
      const slide = byId.get(id);
      if (!slide) throw new Error(`Unknown slide: ${id}`);
      return { ...slide, order };
    });
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
    return carousel.slides;
  });
}

export async function undoSlide(carouselId: string, slideId: string): Promise<CarouselSlide> {
  return carouselMutex.runExclusive(async () => {
    const carousel = await getCarousel(carouselId);
    const slide = carousel.slides.find((item) => item.id === slideId);
    const previous = slide?.previousVersions.pop();
    if (!slide || !previous) throw new Error("No previous slide version");
    slide.html = previous;
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
    return slide;
  });
}

export type CarouselOperation =
  | { type: "add"; html: string; notes?: string }
  | { type: "update"; slideId: string; html: string; notes?: string }
  | { type: "delete"; slideId: string };

export async function applyCarouselOperations(
  carouselId: string,
  operations: CarouselOperation[],
  extras?: { caption?: string; hashtags?: string[]; chatSessionId?: string }
): Promise<CarouselTreatment> {
  return carouselMutex.runExclusive(async () => {
    if (!Array.isArray(operations) || operations.length > MAX_CAROUSEL_SLIDES) {
      throw new Error("Invalid carousel operations");
    }
    const carousel = structuredClone(await getCarousel(carouselId));
    for (const operation of operations) {
      if (operation.type === "add") {
        if (carousel.slides.length >= MAX_CAROUSEL_SLIDES) throw new Error("Maximum slide count reached");
        carousel.slides.push({
          id: randomUUID(), html: validateSlideHtml(operation.html), previousVersions: [],
          order: carousel.slides.length, notes: operation.notes?.slice(0, 500) ?? "",
        });
      } else if (operation.type === "update") {
        const slide = carousel.slides.find((item) => item.id === operation.slideId);
        if (!slide) throw new Error(`Unknown slide: ${operation.slideId}`);
        const html = validateSlideHtml(operation.html);
        if (html !== slide.html) {
          slide.previousVersions.push(slide.html);
          slide.previousVersions = slide.previousVersions.slice(-MAX_SLIDE_VERSIONS);
          slide.html = html;
        }
        if (operation.notes !== undefined) slide.notes = operation.notes.slice(0, 500);
      } else if (operation.type === "delete") {
        const before = carousel.slides.length;
        carousel.slides = carousel.slides.filter((slide) => slide.id !== operation.slideId);
        if (carousel.slides.length === before) throw new Error(`Unknown slide: ${operation.slideId}`);
      } else {
        throw new Error("Unknown carousel operation");
      }
    }
    carousel.slides = carousel.slides.map((slide, order) => ({ ...slide, order }));
    if (extras?.caption !== undefined) carousel.caption = extras.caption.slice(0, 2200);
    if (extras?.hashtags !== undefined) carousel.hashtags = extras.hashtags.slice(0, 30);
    if (extras?.chatSessionId) carousel.chatSessionId = extras.chatSessionId;
    if (operations.length > 0) carousel.status = "draft";
    carousel.updatedAt = new Date().toISOString();
    await carouselTreatmentRepository.save(carousel);
    return carousel;
  });
}
