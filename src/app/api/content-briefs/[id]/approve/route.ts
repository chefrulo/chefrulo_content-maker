import { NextRequest, NextResponse } from "next/server";
import { contentBriefRepository } from "@/repositories/operational-repository";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await contentBriefRepository.get(id);
  brief.status = "approved";
  await contentBriefRepository.save(brief);
  return NextResponse.json({ brief });
}
