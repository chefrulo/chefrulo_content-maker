"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, GitCommitHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BrandBrainReviewArticle, BrandBrainReviewSnapshot } from "@/types/brand-brain-review";

interface Selection {
  approveArticle: boolean;
  ideaIds: string[];
}

function statusVariant(status: string): "success" | "warning" | "secondary" {
  if (status === "approved" || status === "published") return "success";
  if (status === "review") return "warning";
  return "secondary";
}

export default function BrandBrainReviewPage() {
  const [snapshot, setSnapshot] = useState<BrandBrainReviewSnapshot | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/brand-brain-review", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "No se pudo cargar el Brand Brain");
      return;
    }
    setSnapshot(data);
    setSelections({});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data is loaded asynchronously after mount
    void load();
  }, [load]);

  const selectionFor = (article: BrandBrainReviewArticle): Selection =>
    selections[article.slug] ?? { approveArticle: false, ideaIds: [] };

  const toggleArticle = (article: BrandBrainReviewArticle) => {
    const current = selectionFor(article);
    setSelections((previous) => ({
      ...previous,
      [article.slug]: { ...current, approveArticle: !current.approveArticle },
    }));
  };

  const toggleIdea = (article: BrandBrainReviewArticle, ideaId: string) => {
    const current = selectionFor(article);
    const ideaIds = current.ideaIds.includes(ideaId)
      ? current.ideaIds.filter((id) => id !== ideaId)
      : [...current.ideaIds, ideaId];
    setSelections((previous) => ({ ...previous, [article.slug]: { ...current, ideaIds } }));
  };

  const approve = async (article: BrandBrainReviewArticle) => {
    const selection = selectionFor(article);
    const labels = [
      selection.approveArticle ? "el artículo" : "",
      selection.ideaIds.length > 0 ? `${selection.ideaIds.length} idea${selection.ideaIds.length === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(" y ");
    if (!labels || !window.confirm(`¿Aprobar ${labels} de “${article.title}” y crear un commit editorial?`)) return;

    setBusySlug(article.slug);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/brand-brain-review/${article.slug}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo aprobar la selección");
      setNotice(`Aprobación registrada en el commit ${data.commit.slice(0, 12)}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aprobar la selección");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <header>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
          <ArrowLeft className="h-4 w-4" /> Volver al pipeline
        </Link>
        <h1 className="text-2xl font-bold">Brand Brain Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprobá conocimiento canónico. Cada operación crea un commit local trazable en Brand Brain.
        </p>
      </header>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {!snapshot && !error && <p className="text-sm text-muted-foreground">Cargando Brand Brain…</p>}

      {snapshot && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <GitCommitHorizontal className="h-4 w-4" />
            <span className="font-mono">{snapshot.revision.slice(0, 12)}</span>
            <Badge variant={snapshot.clean ? "success" : "destructive"}>
              {snapshot.clean ? "Working tree limpio" : "Hay cambios sin commit"}
            </Badge>
          </div>

          {!snapshot.clean && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Las aprobaciones están bloqueadas hasta resolver los cambios existentes en Brand Brain.
            </p>
          )}

          <div className="space-y-6">
            {snapshot.articles.map((article) => {
              const selection = selectionFor(article);
              const articleApproved = article.status === "approved" || article.status === "published";
              const hasSelection = selection.approveArticle || selection.ideaIds.length > 0;
              return (
                <article key={article.id} className="rounded-xl border border-border bg-surface p-5 space-y-5">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">{article.title}</h2>
                        <Badge variant={statusVariant(article.status)}>{article.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground font-mono">{article.id}</p>
                    </div>
                    {article.primaryTerritory && <Badge variant="outline">{article.primaryTerritory}</Badge>}
                  </header>

                  <details className="rounded-lg border border-border bg-background p-3">
                    <summary className="cursor-pointer text-sm font-medium">Leer artículo canónico</summary>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{article.body}</div>
                  </details>

                  {!articleApproved && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                        checked={selection.approveArticle}
                        onChange={() => toggleArticle(article)}
                      />
                      <span>
                        <span className="block text-sm font-medium">Aprobar artículo canónico</span>
                        <span className="block text-xs text-muted-foreground">Habilita sus ideas aprobadas para generar briefs.</span>
                      </span>
                    </label>
                  )}

                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                      Idea Library ({article.ideas.length})
                    </h3>
                    <div className="space-y-2">
                      {article.ideas.map((idea) => {
                        const approved = idea.status === "approved";
                        const retired = idea.status === "retired";
                        return (
                          <label
                            key={idea.id}
                            className={`flex items-start gap-3 rounded-lg border border-border p-3 ${approved ? "bg-emerald-50/50" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-[var(--accent)]"
                              checked={approved || selection.ideaIds.includes(idea.id)}
                              disabled={approved || retired}
                              onChange={() => toggleIdea(article, idea.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{idea.title}</span>
                                <Badge variant={statusVariant(idea.status)}>{idea.status}</Badge>
                                {idea.signatureIdea && <Badge variant="accent">signature</Badge>}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">{idea.question}</span>
                              <span className="mt-1 block text-xs">{idea.coreInsight}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">
                      {selection.ideaIds.length} ideas seleccionadas
                    </p>
                    <Button
                      variant="accent"
                      disabled={!snapshot.clean || !hasSelection || busySlug !== null}
                      onClick={() => void approve(article)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {busySlug === article.slug ? "Aprobando…" : "Aprobar y crear commit"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
