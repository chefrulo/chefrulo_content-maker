import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { readData } from "@/lib/data";
import {
  voiceoverDir,
  findRecordedBeatFile,
  deleteRecordedBeatFiles,
  extensionFromContentType,
  contentTypeFromExtension,
} from "@/lib/beat-recording";
import type { ReelScript } from "@/types/reel-script";

async function loadScriptAndValidateBeat(
  id: string,
  indexParam: string
): Promise<{ script: ReelScript; index: number } | { error: string; status: number }> {
  const index = Number(indexParam);
  if (!Number.isInteger(index) || index < 0) {
    return { error: "Invalid beat index", status: 400 };
  }

  let script: ReelScript;
  try {
    script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  } catch {
    return { error: "Script not found", status: 404 };
  }

  const beat = script.beats[index];
  if (!beat) {
    return { error: "Beat not found", status: 404 };
  }
  if (!beat.voiceover) {
    return { error: "This beat has no voiceover line to record", status: 400 };
  }

  return { script, index };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  const result = await loadScriptAndValidateBeat(id, indexParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const ext = extensionFromContentType(contentType);
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty recording" }, { status: 400 });
  }

  const dir = voiceoverDir(id);
  await mkdir(dir, { recursive: true });
  await deleteRecordedBeatFiles(id, result.index);
  await writeFile(path.join(dir, `beat-${result.index}.recorded.${ext}`), buffer);

  return NextResponse.json({ ok: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  // Gate on a successful script/beat lookup before touching the filesystem,
  // matching PUT/DELETE below. `id` and `index` are user-controlled path
  // segments; without this gate they would flow straight into
  // voiceoverDir()/findRecordedBeatFile() (which have no path-traversal
  // guard of their own) with no prior validation.
  const result = await loadScriptAndValidateBeat(id, indexParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const filePath = await findRecordedBeatFile(id, result.index);
  if (!filePath) {
    return NextResponse.json({ error: "No recording found" }, { status: 404 });
  }

  const ext = filePath.split(".").pop() ?? "";
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    headers: { "Content-Type": contentTypeFromExtension(ext) },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexParam } = await params;
  const result = await loadScriptAndValidateBeat(id, indexParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await deleteRecordedBeatFiles(id, result.index);
  return NextResponse.json({ ok: true });
}
