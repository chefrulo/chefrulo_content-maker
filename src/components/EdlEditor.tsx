"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Film, ImageIcon, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Edl, EdlBeat } from "@/types/edl";
import type { ReelScript } from "@/types/reel-script";

interface DraftAssignment {
  beatIndex: number;
  filename: string | null;
  trimStartSeconds: number;
}

function assignmentsFromEdl(edl: Edl): DraftAssignment[] {
  return edl.beats.map((beat) => ({
    beatIndex: beat.index,
    filename: beat.kind === "clip" ? beat.filename ?? null : null,
    trimStartSeconds: beat.trimStartSeconds ?? 0,
  }));
}

function targetFor(edl: Edl, index: number): number {
  return edl.beats.find((beat) => beat.index === index)?.targetDurationSeconds ?? 0;
}

export function EdlEditor({
  script,
  edl,
  onSaved,
}: {
  script: ReelScript;
  edl: Edl;
  onSaved: () => void;
}) {
  const [assignments, setAssignments] = useState(() => assignmentsFromEdl(edl));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const footage = edl.footage ?? [];

  const missingCount = useMemo(() => assignments.filter((assignment) => !assignment.filename).length, [assignments]);

  const update = (index: number, change: Partial<DraftAssignment>) => {
    setAssignments((current) => current.map((assignment) => assignment.beatIndex === index
      ? { ...assignment, ...change }
      : assignment));
    setSavedMessage(null);
  };

  const save = async (approve: boolean) => {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const payload = assignments.map((assignment) => {
        const target = targetFor(edl, assignment.beatIndex);
        return {
          ...assignment,
          trimEndSeconds: assignment.filename ? assignment.trimStartSeconds + target : undefined,
        };
      });
      const response = await fetch(`/api/scripts/${script.id}/edl`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: payload, approve }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el montaje");
      setSavedMessage(approve ? "Montaje aprobado. Ya está listo para renderizar." : "Borrador guardado.");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el montaje");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Montaje EDL</h3>
            <Badge variant={edl.status === "approved" ? "success" : "warning"}>
              {edl.status === "approved" ? "Aprobado" : "Borrador"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada corte usa la duración real de su voz. {missingCount === 0 ? "Todos los beats tienen footage." : `${missingCount} beat${missingCount === 1 ? "" : "s"} usarán placa de texto.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void save(false)}>
            <Save className="h-3.5 w-3.5" /> Guardar borrador
          </Button>
          <Button size="sm" variant="accent" disabled={saving} onClick={() => void save(true)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Guardar y aprobar
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {savedMessage && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{savedMessage}</p>}

      <ol className="space-y-4">
        {script.beats.map((scriptBeat, index) => {
          const assignment = assignments.find((item) => item.beatIndex === index)!;
          const persistedBeat = edl.beats.find((beat) => beat.index === index) as EdlBeat | undefined;
          const target = persistedBeat?.targetDurationSeconds ?? 0;
          const selected = footage.find((clip) => clip.filename === assignment.filename);
          const latestStart = selected ? Math.max(0, selected.durationSeconds - target) : 0;
          const sheetUrl = assignment.filename
            ? `/api/scripts/${script.id}/media?asset=contact-sheet&filename=${encodeURIComponent(assignment.filename)}`
            : null;
          const videoUrl = assignment.filename
            ? `/api/scripts/${script.id}/media?asset=video&filename=${encodeURIComponent(assignment.filename)}`
            : null;

          return (
            <li key={index} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Beat {index + 1}</Badge>
                    <Badge variant="secondary">{target.toFixed(2)}s reales</Badge>
                    <Badge variant={assignment.filename ? "default" : "warning"}>
                      {assignment.filename ? "Footage" : "Placa de texto"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium">{scriptBeat.visual}</p>
                  {scriptBeat.voiceover && <p className="mt-1 text-xs text-muted-foreground">Voz: “{scriptBeat.voiceover}”</p>}
                </div>
                <div className="w-full sm:w-72">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Visual asignado</label>
                  <select
                    value={assignment.filename ?? ""}
                    onChange={(event) => update(index, { filename: event.target.value || null, trimStartSeconds: 0 })}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Placa de texto</option>
                    {footage.map((clip) => (
                      <option key={clip.filename} value={clip.filename} disabled={clip.durationSeconds + 0.01 < target}>
                        {clip.filename} ({clip.durationSeconds.toFixed(1)}s){clip.durationSeconds + 0.01 < target ? " — demasiado corto" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {assignment.filename && selected ? (
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_220px]">
                  <div className="space-y-3">
                    {selected.contactSheetPath ? <div className="overflow-hidden rounded-lg bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated local generated asset */}
                        <img src={sheetUrl!} alt={`Fotogramas de ${assignment.filename}`} className="min-h-24 w-full object-contain" />
                      </div> : <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No se pudo generar el contacto visual de este archivo. Revisalo con el reproductor.</p>}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Inicio del corte</label>
                        <Input
                          type="number"
                          min={0}
                          max={latestStart}
                          step="0.1"
                          value={assignment.trimStartSeconds}
                          onChange={(event) => update(index, { trimStartSeconds: Math.min(latestStart, Math.max(0, Number(event.target.value) || 0)) })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Final exacto</label>
                        <Input value={`${(assignment.trimStartSeconds + target).toFixed(2)}s`} disabled />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Duración fuente</label>
                        <Input value={`${selected.durationSeconds.toFixed(2)}s`} disabled />
                      </div>
                    </div>
                    {persistedBeat?.warning && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {persistedBeat.warning}
                      </p>
                    )}
                  </div>
                  <video controls preload="metadata" src={videoUrl!} className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-muted/50 p-4 text-sm text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                  Se renderizará una placa tipográfica con “{scriptBeat.onScreenText || script.hook}”.
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Film className="h-3.5 w-3.5" /> Los contactos muestran tres momentos del clip; el reproductor permite revisar el material completo.
      </p>
    </div>
  );
}
