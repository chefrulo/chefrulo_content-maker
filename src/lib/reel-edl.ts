import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getVideoMetadata } from "@remotion/renderer";
import puppeteer, { type Browser } from "puppeteer";
import sharp from "sharp";
import type { EdlBeat, EdlFootageClip } from "../types/edl.js";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v"]);

export interface EdlAssignmentInput {
  beatIndex: number;
  filename: string | null;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

function assertScriptId(scriptId: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(scriptId)) throw new Error("Invalid script ID");
}

export function footageDirectory(scriptId: string): string {
  assertScriptId(scriptId);
  return path.resolve(process.cwd(), "footage", scriptId);
}

export function contactSheetDirectory(scriptId: string): string {
  assertScriptId(scriptId);
  const dataRoot = path.resolve(process.env.CONTENT_MAKER_DATA_DIR ?? path.join(process.cwd(), "data"));
  return path.join(dataRoot, "edl-assets", scriptId);
}

export function contactSheetFilename(filename: string): string {
  const digest = createHash("sha256").update(filename).digest("hex").slice(0, 16);
  return `${digest}.jpg`;
}

async function createContactSheet(
  browser: Browser,
  sourcePath: string,
  destinationPath: string,
  durationSeconds: number
): Promise<void> {
  const page = await browser.newPage();
  const readerPath = `${destinationPath}.html`;
  const videoUrl = pathToFileURL(sourcePath).href;
  await writeFile(readerPath, `<style>*{box-sizing:border-box}html,body{margin:0;background:#111}video{display:block;width:240px;height:320px;object-fit:contain}</style><video muted preload="auto" src="${videoUrl}"></video>`, "utf8");
  try {
    await page.setViewport({ width: 240, height: 320, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(readerPath).href, { waitUntil: "load", timeout: 15_000 });
    await page.waitForFunction(() => {
      const video = document.querySelector("video");
      return video instanceof HTMLVideoElement && video.readyState >= 2;
    }, { timeout: 15_000 });

    const frames: Buffer[] = [];
    for (const ratio of [0.2, 0.5, 0.8]) {
      const timestamp = Math.max(0, Math.min(durationSeconds - 0.05, durationSeconds * ratio));
      await page.evaluate(async (time) => {
        const video = document.querySelector("video") as HTMLVideoElement;
        if (Math.abs(video.currentTime - time) < 0.01) return;
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Video seek timed out")), 8_000);
          video.addEventListener("seeked", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
          video.currentTime = time;
        });
      }, timestamp);
      frames.push(Buffer.from(await page.screenshot({ type: "jpeg", quality: 82 })));
    }

    await sharp({ create: { width: 728, height: 320, channels: 3, background: "#111111" } })
      .composite(frames.map((input, index) => ({ input, left: index * 244, top: 0 })))
      .jpeg({ quality: 84 })
      .toFile(destinationPath);
  } finally {
    await page.close();
    await rm(readerPath, { force: true });
  }
}

export async function listFootage(scriptId: string, options: { createContactSheets?: boolean } = {}): Promise<EdlFootageClip[]> {
  const { readdir } = await import("node:fs/promises");
  const directory = footageDirectory(scriptId);
  const files = await readdir(directory).catch(() => [] as string[]);
  const clips: EdlFootageClip[] = [];
  const sheetDirectory = contactSheetDirectory(scriptId);
  if (options.createContactSheets) await mkdir(sheetDirectory, { recursive: true });

  for (const filename of files.sort()) {
    if (!VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase())) continue;
    const sourcePath = path.join(directory, filename);
    const metadata = await getVideoMetadata(sourcePath);
    const durationSeconds = metadata.durationInSeconds ?? 0;
    const clip: EdlFootageClip = { filename, durationSeconds };

    clips.push(clip);
  }

  if (options.createContactSheets && clips.length > 0) {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"] });
    try {
      for (const clip of clips) {
        if (clip.durationSeconds <= 0) continue;
        const sheetPath = path.join(sheetDirectory, contactSheetFilename(clip.filename));
        try {
          await createContactSheet(browser, path.join(directory, clip.filename), sheetPath, clip.durationSeconds);
          clip.contactSheetPath = path.relative(process.cwd(), sheetPath);
        } catch (error) {
          console.warn(`No se pudo generar el contacto visual de ${clip.filename}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } finally {
      await browser.close();
    }
  }
  return clips;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeEdlAssignments(
  assignments: EdlAssignmentInput[],
  targetDurations: number[],
  footage: EdlFootageClip[]
): EdlBeat[] {
  const byIndex = new Map(assignments.map((assignment) => [assignment.beatIndex, assignment]));
  const footageByName = new Map(footage.map((clip) => [clip.filename, clip]));

  return targetDurations.map((targetDurationSeconds, index) => {
    if (!finiteNumber(targetDurationSeconds) || targetDurationSeconds <= 0) {
      throw new Error(`Beat ${index} has an invalid target duration`);
    }
    const assignment = byIndex.get(index);
    if (!assignment?.filename) {
      return { index, kind: "textcard", targetDurationSeconds };
    }
    const clip = footageByName.get(assignment.filename);
    if (!clip) {
      return {
        index,
        kind: "textcard",
        targetDurationSeconds,
        warning: `El archivo ${assignment.filename} ya no está disponible.`,
      };
    }
    if (clip.durationSeconds + 0.01 < targetDurationSeconds) {
      return {
        index,
        kind: "textcard",
        targetDurationSeconds,
        warning: `${clip.filename} dura ${clip.durationSeconds.toFixed(1)}s y el beat necesita ${targetDurationSeconds.toFixed(1)}s.`,
      };
    }

    const requestedStart = finiteNumber(assignment.trimStartSeconds) ? assignment.trimStartSeconds : 0;
    const latestStart = Math.max(0, clip.durationSeconds - targetDurationSeconds);
    const trimStartSeconds = Math.min(Math.max(0, requestedStart), latestStart);
    const trimEndSeconds = trimStartSeconds + targetDurationSeconds;
    const wasAdjusted = Math.abs(trimStartSeconds - requestedStart) > 0.01;

    return {
      index,
      kind: "clip",
      targetDurationSeconds,
      filename: clip.filename,
      trimStartSeconds,
      trimEndSeconds,
      ...(wasAdjusted ? { warning: `El inicio se ajustó a ${trimStartSeconds.toFixed(1)}s para que el corte completo entre en el clip.` } : {}),
    };
  });
}

export function attachScriptPaths(scriptId: string, beats: EdlBeat[]): EdlBeat[] {
  assertScriptId(scriptId);
  return beats.map((beat) => beat.kind === "clip" && beat.filename
    ? { ...beat, clipPath: path.join("footage", scriptId, beat.filename) }
    : beat);
}
