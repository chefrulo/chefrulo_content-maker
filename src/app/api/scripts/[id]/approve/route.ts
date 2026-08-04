import { NextRequest, NextResponse } from "next/server";
import { reelScriptRepository } from "@/repositories/operational-repository";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await reelScriptRepository.get(id);
  if (brief.status === "published") {
    return NextResponse.json(
      {
        error: `El guion ya fue publicado el ${brief.publishedAt} (media ${brief.publishedMediaId}) y no puede aprobarse/rechazarse.`,
      },
      { status: 409 }
    );
  }
  brief.status = "approved";
  await reelScriptRepository.save(brief);
  return NextResponse.json({ brief });
}
