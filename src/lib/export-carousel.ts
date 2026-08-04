import { ZipArchive } from "archiver";
import puppeteer, { type Browser } from "puppeteer";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { wrapSlideHtml } from "@/lib/slide-html";
import type { CarouselTreatment } from "@/types/carousel";
import { CAROUSEL_DIMENSIONS } from "@/types/carousel";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser?.connected) {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
  }
  return browser;
}

async function renderSlide(carousel: CarouselTreatment, index: number): Promise<Buffer> {
  const slide = carousel.slides[index];
  if (!slide) throw new Error(`Slide ${index + 1} not found`);
  const { width, height } = CAROUSEL_DIMENSIONS[carousel.aspectRatio];
  const page = await (await getBrowser()).newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(wrapSlideHtml(slide.html, carousel.aspectRatio), { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return sharp(screenshot).toColorspace("srgb").png().toBuffer();
  } finally {
    await page.close();
  }
}

export async function exportCarouselZip(carousel: CarouselTreatment): Promise<Buffer> {
  if (carousel.slides.length === 0) throw new Error("No slides to export");
  const pngs: Buffer[] = [];
  for (let index = 0; index < carousel.slides.length; index += 3) {
    pngs.push(...await Promise.all(carousel.slides.slice(index, index + 3).map((_, offset) => renderSlide(carousel, index + offset))));
  }
  const zip = await new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    pngs.forEach((buffer, index) => archive.append(buffer, { name: `slide-${index + 1}.png` }));
    if (carousel.caption) archive.append(carousel.caption, { name: "caption.txt" });
    void archive.finalize();
  });
  const outputDir = path.resolve(process.env.CONTENT_MAKER_DATA_DIR ?? path.join(process.cwd(), "data"), "exports", "carousels");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${carousel.id}.zip`), zip);
  return zip;
}
