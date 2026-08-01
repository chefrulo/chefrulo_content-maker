"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Type, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { ReelBrief } from "@/types/brief";

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [brief, setBrief] = useState<ReelBrief | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/briefs/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setBrief(data.brief);
    setHasVideo(data.hasVideo);
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
    await fetch(`/api/briefs/${id}/${action}`, { method: "POST" });
    load();
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header>
        <Badge variant="outline">{brief.pillar}</Badge>
        <h1 className="text-2xl font-bold mt-2 leading-snug">{brief.hook}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {brief.format} · ~{brief.estimatedDurationSeconds}s · CTA: {brief.cta}
        </p>
        {brief.inspiredBy.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Inspirado en: {brief.inspiredBy.map((h) => `@${h.replace(/^@/, "")}`).join(", ")}
          </p>
        )}
      </header>

      {brief.status === "pending_review" && (
        <div className="flex gap-2">
          <Button variant="accent" onClick={() => setStatus("approve")}>
            Aprobar
          </Button>
          <Button variant="outline" onClick={() => setStatus("reject")}>
            Rechazar
          </Button>
        </div>
      )}

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
            </li>
          ))}
        </ol>
      </section>

      {brief.status === "approved" && !hasVideo && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Producir video
          </h2>
          <PipelineRunner
            url={`/api/briefs/${id}/produce`}
            triggerLabel="Generar voiceover, EDL y renderizar"
            runningLabel="Produciendo…"
            initialSteps={["Voiceover", "EDL", "Render"]}
            onSuccess={load}
          />
        </section>
      )}

      {hasVideo && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Video
          </h2>
          <video
            key={id}
            controls
            className="w-full max-w-xs rounded-lg border border-border bg-black aspect-9/16"
            src={`/api/exports/${id}`}
          />
        </section>
      )}

      {brief.status === "approved" && hasVideo && (
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
            url={`/api/briefs/${id}/publish`}
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
