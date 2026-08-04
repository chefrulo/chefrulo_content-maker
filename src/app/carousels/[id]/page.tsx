"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, RotateCcw, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidePreview } from "@/components/carousel/SlidePreview";
import type { CarouselAspectRatio, CarouselTreatment } from "@/types/carousel";

interface ChatMessage { role: "user" | "assistant"; text: string }

export default function CarouselEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [carousel, setCarousel] = useState<CarouselTreatment | null>(null);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/carousels/${id}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "No se pudo cargar el carrusel"); return; }
    setCarousel(data.carousel);
    setActive((current) => Math.min(current, Math.max(0, data.carousel.slides.length - 1)));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data is loaded asynchronously after mount
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/carousels/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
  };

  const send = async (text = message) => {
    const prompt = text.trim();
    if (!prompt || working) return;
    setWorking(true); setError(null); setStatusText("Iniciando Claude…"); setMessage("");
    setMessages((items) => [...items, { role: "user", text: prompt }]);
    try {
      const response = await fetch(`/api/carousels/${id}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt }) });
      if (!response.ok || !response.body) throw new Error((await response.json()).error ?? "No se pudo iniciar Claude");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const event of events) {
          const type = event.match(/^event:\s*(.+)$/m)?.[1];
          const raw = event.match(/^data:\s*(.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (type === "status") setStatusText(data.text);
          if (type === "result") setMessages((items) => [...items, { role: "assistant", text: data.text }]);
          if (type === "error") throw new Error(data.error);
        }
      }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falló la generación"); }
    finally { setWorking(false); setStatusText(null); }
  };

  const slideAction = async (slideId: string, action: "delete" | "undo") => {
    const url = `/api/carousels/${id}/slides/${slideId}${action === "undo" ? "/undo" : ""}`;
    await fetch(url, { method: action === "undo" ? "POST" : "DELETE" }); await load();
  };

  const move = async (index: number, delta: number) => {
    if (!carousel) return; const target = index + delta; if (target < 0 || target >= carousel.slides.length) return;
    const ids = carousel.slides.map((slide) => slide.id); [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await fetch(`/api/carousels/${id}/slides`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slideIds: ids }) });
    setActive(target); await load();
  };

  const review = async (action: "approve" | "reject") => {
    const response = await fetch(`/api/carousels/${id}/${action}`, { method: "POST" });
    const data = await response.json(); if (!response.ok) setError(data.error); else setCarousel(data.carousel);
  };

  const exportZip = async () => {
    setWorking(true); setStatusText("Renderizando PNG…");
    try {
      const response = await fetch(`/api/carousels/${id}/export`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Falló la exportación");
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `carousel-${id}.zip`; anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falló la exportación"); }
    finally { setWorking(false); setStatusText(null); }
  };

  if (!carousel) return <main className="p-10 text-sm text-muted-foreground">{error ?? "Cargando carrusel…"}</main>;
  const slide = carousel.slides[active];
  return <main className="min-h-screen flex flex-col">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
      <div className="flex items-center gap-3"><Link href="/" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link><Badge variant="secondary" className="border border-border text-foreground">CARRUSEL · IMÁGENES</Badge><div><h1 className="font-semibold">{carousel.name}</h1><p className="text-xs text-muted-foreground">{carousel.editorialTerritory}</p></div><Badge variant={carousel.status === "approved" ? "success" : "warning"}>{carousel.status}</Badge></div>
      <div className="flex flex-wrap gap-2">
        {(["1:1", "4:5", "9:16"] as CarouselAspectRatio[]).map((ratio) => <Button key={ratio} size="sm" variant={carousel.aspectRatio === ratio ? "default" : "outline"} onClick={() => void patch({ aspectRatio: ratio })}>{ratio}</Button>)}
        <Button size="sm" variant="outline" onClick={() => void review("reject")}>Rechazar</Button>
        <Button size="sm" variant="accent" onClick={() => void review("approve")}>Aprobar</Button>
        <Button size="sm" onClick={() => void exportZip()} disabled={working || carousel.slides.length === 0}><Download className="h-4 w-4" /> Exportar ZIP</Button>
      </div>
    </header>
    {error && <p className="m-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid flex-1 min-h-0 lg:grid-cols-[340px_1fr]">
      <aside className="flex min-h-[520px] flex-col border-r border-border bg-surface">
        <div className="border-b border-border p-4"><h2 className="text-sm font-semibold">Diseñador con Claude</h2><p className="text-xs text-muted-foreground">Parte del brief aprobado; pedí un carrusel o refiná slides.</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && <Button variant="outline" onClick={() => void send("Creá un carrusel completo de 7 slides a partir del brief aprobado.")}>Generar primer carrusel</Button>}
          {messages.map((item, index) => <div key={index} className={`rounded-lg p-3 text-sm ${item.role === "user" ? "bg-foreground text-background" : "bg-muted"}`}>{item.text}</div>)}
          {working && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{statusText}</div>}
        </div>
        <div className="border-t border-border p-3 flex gap-2"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ej: hacé el slide 1 más directo…" className="min-h-20 flex-1 resize-none rounded-lg bg-muted p-3 text-sm outline-none" /><Button size="icon" disabled={working || !message.trim()} onClick={() => void send()}><Send className="h-4 w-4" /></Button></div>
      </aside>
      <section className="flex min-h-[600px] flex-col bg-muted/50">
        <div className="flex-1 min-h-0 p-6">{slide ? <SlidePreview html={slide.html} aspectRatio={carousel.aspectRatio} className="h-full w-full" /> : <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">Pedile a Claude que cree el primer carrusel.</div>}</div>
        <div className="border-t border-border bg-surface p-3 overflow-x-auto"><div className="flex gap-3">
          {carousel.slides.map((item, index) => <div key={item.id} className="relative shrink-0"><button onClick={() => setActive(index)} className={`h-24 w-20 overflow-hidden rounded-lg border-2 ${index === active ? "border-accent" : "border-border"}`}><SlidePreview html={item.html} aspectRatio={carousel.aspectRatio} className="h-full w-full" /></button><div className="mt-1 flex justify-center gap-1"><button onClick={() => void move(index, -1)} disabled={index === 0}><ChevronLeft className="h-3 w-3" /></button><button onClick={() => void slideAction(item.id, "undo")} disabled={item.previousVersions.length === 0}><RotateCcw className="h-3 w-3" /></button><button onClick={() => void slideAction(item.id, "delete")}><Trash2 className="h-3 w-3 text-destructive" /></button><button onClick={() => void move(index, 1)} disabled={index === carousel.slides.length - 1}><ChevronRight className="h-3 w-3" /></button></div></div>)}
        </div></div>
      </section>
    </div>
  </main>;
}
