import { NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { contactSheetDirectory, contactSheetFilename, footageDirectory } from "@/lib/reel-edl";
import { reelScriptRepository } from "@/repositories/operational-repository";

function streamFile(request: NextRequest, filePath: string, contentType: string): Response {
  const stat = statSync(filePath);
  const range = request.headers.get("range");
  if (!range) {
    return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
      headers: { "Content-Type": contentType, "Content-Length": String(stat.size), "Accept-Ranges": "bytes" },
    });
  }
  const match = range.match(/bytes=(\d+)-(\d*)/);
  const start = match ? Number(match[1]) : 0;
  const requestedEnd = match?.[2] ? Number(match[2]) : stat.size - 1;
  const end = Math.min(requestedEnd, stat.size - 1);
  if (!Number.isFinite(start) || start < 0 || start > end) return new Response("Invalid range", { status: 416 });
  return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await reelScriptRepository.get(id); } catch { return new Response("Not found", { status: 404 }); }
  const filename = request.nextUrl.searchParams.get("filename") ?? "";
  const asset = request.nextUrl.searchParams.get("asset") ?? "video";
  if (!filename || path.basename(filename) !== filename) return new Response("Invalid filename", { status: 400 });

  const filePath = asset === "contact-sheet"
    ? path.join(contactSheetDirectory(id), contactSheetFilename(filename))
    : path.join(footageDirectory(id), filename);
  if (!existsSync(filePath)) return new Response("Not found", { status: 404 });
  const videoType = path.extname(filename).toLowerCase() === ".mov" ? "video/quicktime" : "video/mp4";
  return streamFile(request, filePath, asset === "contact-sheet" ? "image/jpeg" : videoType);
}
