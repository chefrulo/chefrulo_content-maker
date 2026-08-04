import { NextRequest, NextResponse } from "next/server";
import { contentBriefRepository } from "@/repositories/operational-repository";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const brief = await contentBriefRepository.get(id);
    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ error: "Content brief not found" }, { status: 404 });
  }
}
