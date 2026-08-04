"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { wrapSlideHtml } from "@/lib/slide-html";
import type { CarouselAspectRatio } from "@/types/carousel";
import { CAROUSEL_DIMENSIONS } from "@/types/carousel";

export function SlidePreview({ html, aspectRatio, className = "" }: { html: string; aspectRatio: CarouselAspectRatio; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dimensions = CAROUSEL_DIMENSIONS[aspectRatio];
  const srcDoc = useMemo(() => wrapSlideHtml(html, aspectRatio), [html, aspectRatio]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(size.width / dimensions.width, size.height / dimensions.height);
  return (
    <div ref={container} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {scale > 0 && <div className="relative overflow-hidden rounded-lg shadow-lg" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
        <iframe sandbox="" title="Slide preview" srcDoc={srcDoc} style={{ width: dimensions.width, height: dimensions.height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }} />
      </div>}
    </div>
  );
}
