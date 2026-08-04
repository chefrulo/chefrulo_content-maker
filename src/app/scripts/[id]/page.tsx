"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Type, Clapperboard, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PipelineRunner } from "@/components/PipelineRunner";
import { BeatRecorder } from "@/components/BeatRecorder";
import { EdlEditor } from "@/components/EdlEditor";
import type { ReelScript } from "@/types/reel-script";
import type { Edl } from "@/types/edl";
import type { VoiceoverTimeline } from "@/types/voiceover";

export default function ScriptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [brief, setBrief] = useState<ReelScript | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoIsCurrent, setVideoIsCurrent] = useState(false);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [voiceover, setVoiceover] = useState<VoiceoverTimeline | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [recordedBeats, setRecordedBeats] = useState<number[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/scripts/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setBrief(data.brief);
    setHasVideo(data.hasVideo);
    setVideoIsCurrent(data.videoIsCurrent ?? false);
    setEdl(data.production?.edl ?? null);
    setVoiceover(data.production?.voiceover ?? null);
    setRecordedBeats(data.recordedBeats ?? []);
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
    await fetch(`/api/scripts/${id}/${action}`, { method: "POST" });
    load();
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="accent"><Film className="mr-1 h-3 w-3" /> REEL · VIDEO</Badge>
          <Badge variant="outline">{brief.brandPillar}</Badge>
          <Badge variant="secondary">{brief.editorialTerritory}</Badge>
        </div>
        <h1 className="text-2xl font-bold mt-2 leading-snug">{brief.hook}</h1>
        <p className="text-sm text-muted-foreground mt-1">{brief.topic}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {brief.contentPattern} · ~{brief.estimatedDurationSeconds}s · CTA: {brief.cta}
        </p>
        {brief.inspiredBy.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Inspirado en: {brief.inspiredBy.map((h) => `@${h.replace(/^@/, "")}`).join(", ")}
          </p>
        )}
        <a
          href={`/api/scripts/${id}/shotlist`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-accent hover:underline"
        >
          Descargar hoja de rodaje (PDF)
        </a>
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

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Beats ({brief.beats.length})
        </h2>
        <ol className="space-y-3">
          {brief.beats.map((beat, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface p-3 space-y-1.5">
              <div className="flex items-start gap-2 text-sm">
                <Clapperboard className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{beat.visual}</span>
              </div>
              {beat.voiceover && (
                <div className="flex items-start gap-2 text-sm text-accent">
                  <Mic className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>&ldquo;{beat.voiceover}&rdquo;</span>
                </div>
              )}
              {beat.onScreenText && (
                <div className="flex items-start gap-2 text-sm font-medium">
                  <Type className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{beat.onScreenText}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground pl-6">~{beat.estimatedSeconds}s</p>
              {beat.voiceover && (
                <BeatRecorder
                  scriptId={id}
                  beatIndex={i}
                  initiallyRecorded={recordedBeats.includes(i)}
                  onChange={load}
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      {brief.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            1. Preparar voz y propuesta de montaje
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Mide la voz real, analiza tres fotogramas de cada clip en <code>footage/{id}/</code> y propone una asignación. No renderiza todavía.
          </p>
          <PipelineRunner
            url={`/api/scripts/${id}/prepare`}
            triggerLabel={edl ? "Regenerar voz y propuesta de montaje" : "Preparar voz y montaje"}
            runningLabel="Preparando…"
            initialSteps={["Voz y tiempos reales", "Selección de footage"]}
            onSuccess={load}
          />
        </section>
      )}

      {brief.status === "approved" && edl && voiceover && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            2. Revisar clips y cortes
          </h2>
          <EdlEditor key={edl.updatedAt} script={brief} edl={edl} onSaved={load} />
        </section>
      )}

      {brief.status === "approved" && edl?.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            3. Renderizar reel
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">El render usa exactamente los clips, cortes y tiempos aprobados arriba.</p>
          <PipelineRunner
            url={`/api/scripts/${id}/render`}
            triggerLabel={hasVideo ? "Volver a renderizar reel" : "Renderizar reel final"}
            runningLabel="Renderizando…"
            initialSteps={["Render final"]}
            onSuccess={load}
          />
        </section>
      )}

      {hasVideo && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Reel renderizado
          </h2>
          {!videoIsCurrent && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Este video es anterior al montaje actual. Volvé a renderizar antes de publicarlo.</p>}
          <video
            key={id}
            controls
            className="w-full max-w-xs rounded-lg border border-border bg-black aspect-9/16"
            src={`/api/exports/${id}`}
          />
        </section>
      )}

      {brief.status === "approved" && hasVideo && videoIsCurrent && edl?.status === "approved" && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Publicar
          </h2>
          <p className="text-xs text-muted-foreground mb-2">
            Esto publica en la cuenta real de Instagram. Escribí <strong>publicar</strong> para habilitar el botón.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="publicar"
            className="max-w-xs mb-3"
          />
          <PipelineRunner
            url={`/api/scripts/${id}/publish`}
            body={{ confirm: true }}
            triggerLabel="Publicar en Instagram"
            runningLabel="Publicando…"
            variant="destructive"
            initialSteps={["Publish"]}
            disabled={confirmText.trim().toLowerCase() !== "publicar"}
            onSuccess={load}
          />
        </section>
      )}

      {brief.status === "published" && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-emerald-800">Publicado</p>
          <p className="text-emerald-700 mt-1">
            {brief.publishedAt} · media {brief.publishedMediaId}
          </p>
        </section>
      )}
    </main>
  );
}
