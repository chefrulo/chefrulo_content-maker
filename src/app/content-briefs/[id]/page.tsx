"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { ContentBrief } from "@/types/content-brief";
import type { CarouselTreatment } from "@/types/carousel";

export default function ContentBriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [carousels, setCarousels] = useState<CarouselTreatment[]>([]);

  const load = useCallback(async () => {
    const [res, carouselRes] = await Promise.all([
      fetch(`/api/content-briefs/${id}`),
      fetch(`/api/content-briefs/${id}/carousels`),
    ]);
    if (!res.ok) return;
    const [data, carouselData] = await Promise.all([res.json(), carouselRes.json()]);
    setBrief(data.brief);
    if (carouselRes.ok) setCarousels(carouselData.carousels);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, setState happens after the await
    load();
  }, [load]);

  if (!brief) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  const setStatus = async (action: "approve" | "reject") => {
    await fetch(`/api/content-briefs/${id}/${action}`, { method: "POST" });
    load();
  };

  const createCarousel = async () => {
    const response = await fetch(`/api/content-briefs/${id}/carousels`, { method: "POST" });
    const data = await response.json();
    if (response.ok) router.push(`/carousels/${data.carousel.id}`);
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{brief.brandPillar}</Badge>
          <Badge variant="secondary">{brief.editorialTerritory}</Badge>
        </div>
        <h1 className="text-2xl font-bold mt-2 leading-snug">{brief.hook}</h1>
        <p className="text-xs text-muted-foreground mt-1">Idea original: {brief.ideaText}</p>
      </header>

      {(brief.status === "pending_review" || brief.status === "approved") && (
        <div className="flex gap-2">
          {brief.status === "pending_review" && (
            <Button variant="accent" onClick={() => setStatus("approve")}>
              Aprobar
            </Button>
          )}
          <Button variant="outline" onClick={() => setStatus("reject")}>
            Rechazar
          </Button>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Mensaje central</h2>
          <p className="text-sm">{brief.coreMessage}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Insight cultural</h2>
          <p className="text-sm">{brief.culturalInsight}</p>
        </div>
        {brief.personalStory && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Historia personal</h2>
            <p className="text-sm">{brief.personalStory}</p>
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Valor educativo</h2>
          <p className="text-sm">{brief.educationalValue}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">CTA</h2>
          <p className="text-sm">{brief.cta}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Linaje editorial</h2>
        <dl className="grid gap-1 text-xs sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">Artículo</dt>
          <dd className="font-mono">{brief.sourceArticleId} ({brief.sourceArticleSlug})</dd>
          <dt className="text-muted-foreground">Idea</dt>
          <dd className="font-mono">{brief.ideaId}</dd>
          <dt className="text-muted-foreground">Brand Brain</dt>
          <dd className="font-mono" title={brief.brandBrainRevision}>{brief.brandBrainRevision.slice(0, 12)}</dd>
        </dl>
      </section>

      {brief.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Generar guion</h2>
          {brief.reelScriptId ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ya se generó un guion a partir de este brief.</p>
              <Link
                href={`/scripts/${brief.reelScriptId}`}
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Ver guion generado
              </Link>
            </div>
          ) : (
            <PipelineRunner
              url={`/api/content-briefs/${id}/generate-script`}
              triggerLabel="Generar guion"
              runningLabel="Generando…"
              initialSteps={["Script"]}
              onSuccess={load}
            />
          )}
        </section>
      )}

      {brief.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Carruseles</h2>
          {carousels.length > 0 && <div className="mb-3 space-y-2">{carousels.map((carousel) => (
            <Link key={carousel.id} href={`/carousels/${carousel.id}`} className="block rounded-lg border border-border bg-surface p-3 text-sm hover:border-muted-foreground/40">
              {carousel.name} · {carousel.slides.length} slides · {carousel.status}
            </Link>
          ))}</div>}
          <Button variant="outline" onClick={() => void createCarousel()}>
            {carousels.length > 0 ? "Crear otro carrusel" : "Crear carrusel"}
          </Button>
        </section>
      )}
    </main>
  );
}
