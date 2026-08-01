"use client";

import { useEffect, useState, useCallback } from "react";
import { BriefCard } from "@/components/BriefCard";
import { PipelineRunner } from "@/components/PipelineRunner";
import type { ReelBrief } from "@/types/brief";

const STATUS_ORDER: ReelBrief["status"][] = ["pending_review", "approved", "published", "rejected"];
const STATUS_TITLE: Record<ReelBrief["status"], string> = {
  pending_review: "Pendientes de revisión",
  approved: "Aprobados",
  published: "Publicados",
  rejected: "Rechazados",
};

export default function DashboardPage() {
  const [briefs, setBriefs] = useState<ReelBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/briefs");
    const data = await res.json();
    setBriefs(data.briefs);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, setState happens after the await
    load();
  }, [load]);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: briefs.filter((b) => b.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Chef Rulo — Reels Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Research → briefs → producción → publicación, todo local.
        </p>
      </header>

      <section className="mb-10">
        <PipelineRunner
          url="/api/research"
          triggerLabel="Correr research + generar briefs"
          runningLabel="Scrapeando y generando briefs…"
          initialSteps={["Research", "Briefs"]}
          onSuccess={load}
        />
      </section>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && briefs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay briefs. Corré research para generar los primeros.
        </p>
      )}

      {grouped.map((group) => (
        <section key={group.status} className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {STATUS_TITLE[group.status]} ({group.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
