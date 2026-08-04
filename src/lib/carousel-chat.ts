import type { ReelsBrand } from "@/types/brand";
import type { ContentBrief } from "@/types/content-brief";
import type { CarouselTreatment } from "@/types/carousel";
import { CAROUSEL_DIMENSIONS, MAX_CAROUSEL_SLIDES } from "@/types/carousel";
import type { CarouselOperation } from "@/lib/carousels";

interface CarouselChatResult {
  message: string;
  operations: CarouselOperation[];
  caption?: string;
  hashtags?: string[];
}

export function buildCarouselSystemPrompt(
  brand: ReelsBrand,
  brief: ContentBrief,
  carousel: CarouselTreatment,
  foundation: string
): string {
  const dimensions = CAROUSEL_DIMENSIONS[carousel.aspectRatio];
  const visual = brand.visualDesign;
  const slides = carousel.slides.length === 0
    ? "No slides yet."
    : carousel.slides.map((slide) => `Slide ${slide.order + 1} ID=${slide.id}\nNotes: ${slide.notes}\nHTML:\n${slide.html}`).join("\n\n");

  return `You are the carousel treatment designer for ${brand.name}. Turn the approved editorial brief into a visually coherent Instagram carousel without changing its claims or inventing personal memories.

EDITORIAL FOUNDATION AT COMMIT ${brief.brandBrainRevision}:
${foundation}

APPROVED CONTENT BRIEF:
- Hook: ${brief.hook}
- Core message: ${brief.coreMessage}
- Cultural insight: ${brief.culturalInsight}
${brief.personalStory ? `- Documented personal story: ${brief.personalStory}\n` : ""}- Educational value: ${brief.educationalValue}
- CTA: ${brief.cta}

VISUAL SYSTEM:
- Canvas: ${dimensions.width}x${dimensions.height}px (${carousel.aspectRatio})
- Colors: primary ${visual.colors.primary}, secondary ${visual.colors.secondary}, accent ${visual.colors.accent}, background ${visual.colors.background}, surface ${visual.colors.surface}
- Fonts: heading ${visual.fonts.heading}, body ${visual.fonts.body}
- Style: ${visual.styleKeywords.join(", ")}

CURRENT SLIDES (${carousel.slides.length}/${MAX_CAROUSEL_SLIDES}):
${slides}

Return ONLY a JSON object with this shape:
{
  "message": "short explanation in Spanish",
  "operations": [
    {"type":"add","html":"BODY-LEVEL HTML","notes":"purpose"},
    {"type":"update","slideId":"existing-id","html":"BODY-LEVEL HTML","notes":"purpose"},
    {"type":"delete","slideId":"existing-id"}
  ],
  "caption": "optional Instagram caption",
  "hashtags": ["optional", "without-hash-symbol"]
}

Rules: no markdown fences; maximum 10 operations; body-level HTML only; inline CSS or style tags; no JavaScript, iframe, external scripts, html/head/body tags. Use one idea per slide, strong readable hierarchy, 60-80px safe padding, high contrast, consistent visual language, and never introduce facts absent from the brief or foundation. If asked to create a carousel from scratch, create 6-8 slides: hook, context, progressive insights, summary, CTA. If asked to revise, update the relevant existing slide IDs instead of duplicating them.`;
}

export function parseCarouselChatResult(raw: string): CarouselChatResult {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const parsed = JSON.parse(text) as Partial<CarouselChatResult>;
  if (typeof parsed.message !== "string" || !Array.isArray(parsed.operations)) {
    throw new Error("Claude returned an invalid carousel response");
  }
  if (parsed.operations.length > 10) throw new Error("Claude returned too many operations");
  return {
    message: parsed.message,
    operations: parsed.operations as CarouselOperation[],
    ...(typeof parsed.caption === "string" ? { caption: parsed.caption } : {}),
    ...(Array.isArray(parsed.hashtags) && parsed.hashtags.every((tag) => typeof tag === "string")
      ? { hashtags: parsed.hashtags }
      : {}),
  };
}
