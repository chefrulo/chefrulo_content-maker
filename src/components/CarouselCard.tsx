import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CarouselTreatment } from "@/types/carousel";

export function CarouselCard({ carousel }: { carousel: CarouselTreatment }) {
  return <Link href={`/carousels/${carousel.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-muted-foreground/40">
    <div className="flex flex-wrap gap-1.5 mb-2">
      <Badge variant={carousel.status === "approved" ? "success" : carousel.status === "rejected" ? "destructive" : "warning"}>{carousel.status}</Badge>
      <Badge variant="outline">{carousel.aspectRatio}</Badge>
      <Badge variant="secondary">{carousel.slides.length} slides</Badge>
    </div>
    <h3 className="text-sm font-semibold leading-snug">{carousel.name}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{carousel.editorialTerritory}</p>
  </Link>;
}
