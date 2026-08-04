import { NextResponse } from "next/server";
import { reelScriptRepository } from "@/repositories/operational-repository";

export async function GET() {
  const briefs = await reelScriptRepository.list();
  return NextResponse.json({ briefs });
}
