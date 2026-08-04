import { NextResponse } from "next/server";
import { listCarousels } from "@/lib/carousels";

export async function GET() {
  return NextResponse.json({ carousels: await listCarousels() });
}
