import type { CarouselAspectRatio } from "@/types/carousel";
import { CAROUSEL_DIMENSIONS } from "@/types/carousel";

export function extractFontFamilies(html: string): string[] {
  const families = new Set<string>();
  const generics = new Set(["serif", "sans-serif", "monospace", "system-ui", "inherit"]);
  for (const match of html.matchAll(/font-family:\s*['"]?([^;'"}\n]+?)['"]?\s*[;}"]/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().replace(/['"]/g, "");
      if (name && !generics.has(name.toLowerCase())) families.add(name);
    }
  }
  return [...families];
}

export function wrapSlideHtml(slideHtml: string, aspectRatio: CarouselAspectRatio): string {
  const { width, height } = CAROUSEL_DIMENSIONS[aspectRatio];
  const fonts = extractFontFamilies(slideHtml);
  const fontLink = fonts.length > 0
    ? `<link href="https://fonts.googleapis.com/css2?${fonts.map((font) => `family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800`).join("&")}&display=swap" rel="stylesheet">`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width},initial-scale=1">${fontLink}<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${slideHtml}</body></html>`;
}
