import { NextResponse } from "next/server";
import { contentBriefRepository } from "@/repositories/operational-repository";

export async function GET() {
  const briefs = await contentBriefRepository.list();
  return NextResponse.json({ briefs });
}
