export type CarouselAspectRatio = "1:1" | "4:5" | "9:16";
export type CarouselStatus = "draft" | "approved" | "rejected";

export interface CarouselSlide {
  id: string;
  html: string;
  previousVersions: string[];
  order: number;
  notes: string;
}

export interface CarouselTreatment {
  id: string;
  contentBriefId: string;
  ideaId: string;
  sourceArticleId: string;
  sourceArticleSlug: string;
  brandBrainRevision: string;
  name: string;
  hook: string;
  editorialTerritory: string;
  createdAt: string;
  updatedAt: string;
  aspectRatio: CarouselAspectRatio;
  slides: CarouselSlide[];
  caption?: string;
  hashtags?: string[];
  chatSessionId: string | null;
  status: CarouselStatus;
}

export const CAROUSEL_DIMENSIONS: Record<CarouselAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export const MAX_CAROUSEL_SLIDES = 20;
export const MAX_SLIDE_VERSIONS = 5;
