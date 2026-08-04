"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { ContentBriefCard } from "@/components/ContentBriefCard";
import { ScriptCard } from "@/components/ScriptCard";
import { PipelineRunner } from "@/components/PipelineRunner";
import { Button } from "@/components/ui/button";
import type { ContentBrief } from "@/types/content-brief";
import type { ReelScript } from "@/types/reel-script";

const BRIEF_STATUS_ORDER: ContentBrief["status"][] = ["pending_review", "approved", "rejected"];
const BRIEF_STATUS_TITLE: Record<ContentBrief["status"], string> = {
  pending_review: "Briefs pendientes de revisión",
  approved: "Briefs aprobados",
  rejected: "Briefs rechazados",
};

const SCRIPT_STATUS_ORDER: ReelScript["status"][] = ["pending_review", "approved", "published", "rejected"];
const SCRIPT_STATUS_TITLE: Record<ReelScript["status"], string> = {
  pending_review: "Guiones pendientes de revisión",
  approved: "Guiones aprobados",
  published: "Publicados",
  rejected: "Guiones rechazados",
};

export default function DashboardPage() {
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [scripts, setScripts] = useState<ReelScript[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [briefsRes, scriptsRes] = await Promise.all([fetch("/api/content-briefs"), fetch("/api/scripts")]);
    const briefsData = await briefsRes.json();
    const scriptsData = await scriptsRes.json();
    setBriefs(briefsData.briefs);
    setScripts(scriptsData.briefs); // /api/scripts still returns { briefs } for now, see Task 13
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount, setState happens after the await
    load();
  }, [load]);

  const groupedBriefs = BRIEF_STATUS_ORDER.map((status) => ({
    status,
    items: briefs.filter((b) => b.status === status),
  })).filter((g) => g.items.length > 0);

  const groupedScripts = SCRIPT_STATUS_ORDER.map((status) => ({
    status,
    items: scripts.filter((s) => s.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chef Rulo — Reels Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Research → briefs → guion → producción → publicación, todo local.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/brand-brain"><BookOpenCheck className="h-4 w-4" /> Revisar Brand Brain</Link>
        </Button>
      </header>

      <section className="mb-10 flex flex-wrap gap-3">
        <PipelineRunner
          url="/api/research"
          triggerLabel="Correr research"
          runningLabel="Scrapeando y analizando tendencias…"
          initialSteps={["Scrape", "Trend report"]}
          onSuccess={load}
        />
        <PipelineRunner
          url="/api/content-briefs/generate"
          triggerLabel="Generar briefs desde Idea Library"
          runningLabel="Generando briefs…"
          initialSteps={["Briefs"]}
          onSuccess={load}
        />
      </section>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && briefs.length === 0 && scripts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay briefs. Corré research y generá briefs para empezar.
        </p>
      )}

      {groupedBriefs.map((group) => (
        <section key={`brief-${group.status}`} className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {BRIEF_STATUS_TITLE[group.status]} ({group.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((brief) => (
              <ContentBriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </section>
      ))}

      {groupedScripts.map((group) => (
        <section key={`script-${group.status}`} className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {SCRIPT_STATUS_TITLE[group.status]} ({group.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
