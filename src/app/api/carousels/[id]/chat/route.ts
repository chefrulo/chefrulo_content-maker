import { NextRequest, NextResponse } from "next/server";
import { runClaudeAgent } from "@/lib/claude-agent";
import { brandBrainGateway } from "@/lib/brand-brain";
import { buildCarouselSystemPrompt, parseCarouselChatResult } from "@/lib/carousel-chat";
import { applyCarouselOperations, getCarousel } from "@/lib/carousels";
import { getBrand } from "@/lib/brand";
import { contentBriefRepository } from "@/repositories/operational-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 480;

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin generation is not allowed" }, { status: 403 });
  let body: { message?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 10_000) {
    return NextResponse.json({ error: "A message between 1 and 10000 characters is required" }, { status: 400 });
  }
  const message = body.message;
  const { id } = await params;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send("status", { text: "Claude está diseñando el tratamiento…" });
        const carousel = await getCarousel(id);
        const [brief, brand, foundation] = await Promise.all([
          contentBriefRepository.get(carousel.contentBriefId),
          getBrand(),
          brandBrainGateway.loadFoundationAtRevision(carousel.brandBrainRevision),
        ]);
        const result = await runClaudeAgent({
          prompt: message.trim(),
          systemPrompt: buildCarouselSystemPrompt(brand, brief, carousel, foundation),
          sessionId: carousel.chatSessionId ?? undefined,
          maxBudgetUsd: 1,
          name: "chefrulo-carousel-designer",
          timeoutMs: 420_000,
        });
        const parsed = parseCarouselChatResult(result.result);
        await applyCarouselOperations(id, parsed.operations, {
          ...(parsed.caption ? { caption: parsed.caption } : {}),
          ...(parsed.hashtags ? { hashtags: parsed.hashtags } : {}),
          ...(result.sessionId ? { chatSessionId: result.sessionId } : {}),
        });
        send("result", { text: parsed.message, operationCount: parsed.operations.length });
        send("done", { ok: true });
      } catch (error) {
        send("error", { error: error instanceof Error ? error.message : "Carousel generation failed" });
        send("done", { ok: false });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
