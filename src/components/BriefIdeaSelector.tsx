"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { LibraryIdea } from "@/lib/idea-library";

interface AvailableIdeasResponse {
  ideas: LibraryIdea[];
  maxSelection: number;
  error?: string;
}

export function BriefIdeaSelector({ onGenerated }: { onGenerated: () => void }) {
  const [data, setData] = useState<AvailableIdeasResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/brief-ideas", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudieron cargar las ideas aprobadas");
      return;
    }
    setData(payload);
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data is loaded asynchronously after mount
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const grouped = new Map<string, LibraryIdea[]>();
    for (const idea of data?.ideas ?? []) {
      grouped.set(idea.articleSlug, [...(grouped.get(idea.articleSlug) ?? []), idea]);
    }
    return [...grouped.entries()];
  }, [data]);

  const toggle = (ideaId: string) => {
    setSelectedIds((current) => {
      if (current.includes(ideaId)) return current.filter((id) => id !== ideaId);
      if (data && current.length >= data.maxSelection) return current;
      return [...current, ideaId];
    });
  };

  const selectAll = () => {
    if (!data) return;
    const availableIds = data.ideas.slice(0, data.maxSelection).map((idea) => idea.ideaId);
    setSelectedIds(selectedIds.length === availableIds.length ? [] : availableIds);
  };

  const afterGeneration = () => {
    void load();
    onGenerated();
  };

  if (error) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  }
  if (!data) return <p className="text-sm text-muted-foreground">Cargando ideas disponibles…</p>;

  if (data.ideas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">No hay ideas aprobadas disponibles.</p>
        <p className="mt-1 text-muted-foreground">
          Aprobá artículos e ideas en <Link href="/brand-brain" className="text-accent hover:underline">Brand Brain Review</Link>,
          o revisá los briefs existentes.
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.length === Math.min(data.ideas.length, data.maxSelection);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Generar briefs desde Idea Library</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Elegí exactamente qué ideas aprobadas convertir en briefs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          {allSelected ? "Quitar selección" : `Seleccionar todas (${Math.min(data.ideas.length, data.maxSelection)})`}
        </Button>
      </div>

      <div className="space-y-3">
        {groups.map(([articleSlug, ideas]) => (
          <details key={articleSlug} open className="rounded-lg border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium capitalize">
              {articleSlug} <span className="text-muted-foreground">({ideas.length})</span>
            </summary>
            <div className="mt-3 space-y-2">
              {ideas.map((idea) => (
                <label key={idea.ideaId} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    checked={selectedIds.includes(idea.ideaId)}
                    disabled={!selectedIds.includes(idea.ideaId) && selectedIds.length >= data.maxSelection}
                    onChange={() => toggle(idea.ideaId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {idea.title}
                      {idea.signatureIdea && <Badge variant="accent">signature</Badge>}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{idea.ideaText}</span>
                  </span>
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          <p>{selectedIds.length} de {data.ideas.length} ideas seleccionadas</p>
          <p>Usa la cuota de Claude Pro; no utiliza OpenAI TTS en este paso.</p>
        </div>
        <PipelineRunner
          url="/api/content-briefs/generate"
          body={{ ideaIds: selectedIds }}
          triggerLabel={selectedIds.length === 0
            ? "Generar briefs"
            : `Generar ${selectedIds.length} brief${selectedIds.length === 1 ? "" : "s"}`}
          runningLabel="Generando briefs…"
          initialSteps={["Briefs"]}
          disabled={selectedIds.length === 0}
          confirmMessage={`Se generarán ${selectedIds.length} briefs usando tu cuota de Claude Pro. Este paso no genera cargos de OpenAI TTS. ¿Continuar?`}
          onSuccess={afterGeneration}
        />
      </div>
    </div>
  );
}
