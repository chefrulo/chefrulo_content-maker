import { config } from "dotenv";
config({ path: ".env.local" });

import { readDataSafe, writeData } from "../lib/data.js";
import { runApifyActor } from "../lib/apify.js";
import type {
  InspirationAccountsConfig,
  InspirationReel,
  InspirationScrapeResult,
} from "../types/inspiration.js";

const RESULTS_LIMIT = 12;

interface RawApifyReel {
  shortCode: string;
  url: string;
  caption: string | null;
  hashtags: string[] | null;
  likesCount: number | null;
  commentsCount: number | null;
  videoViewCount: number | null;
  videoPlayCount: number | null;
  videoUrl: string | null;
  displayUrl: string | null;
  videoDuration: number | null;
  musicInfo: { musicTitle?: string; musicArtist?: string } | null;
  timestamp: string;
  ownerUsername: string;
}

function toInspirationReel(raw: RawApifyReel): InspirationReel {
  return {
    shortCode: raw.shortCode,
    url: raw.url,
    caption: raw.caption ?? "",
    hashtags: raw.hashtags ?? [],
    likesCount: raw.likesCount ?? 0,
    commentsCount: raw.commentsCount ?? 0,
    videoViewCount: raw.videoViewCount ?? null,
    videoPlayCount: raw.videoPlayCount ?? null,
    videoUrl: raw.videoUrl ?? null,
    displayUrl: raw.displayUrl ?? null,
    videoDuration: raw.videoDuration ?? null,
    musicTitle: raw.musicInfo?.musicTitle ?? null,
    musicArtist: raw.musicInfo?.musicArtist ?? null,
    timestamp: raw.timestamp,
  };
}

async function main() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN not set in .env.local");
  }
  const actorId = process.env.APIFY_ACTOR_ID || "apify/instagram-scraper";

  const accounts = await readDataSafe<InspirationAccountsConfig>("inspiration-accounts.json", {
    handles: [],
  });

  if (accounts.handles.length === 0) {
    console.log(
      "No hay handles configurados. Editá data/inspiration-accounts.json con algo como:\n" +
        '{ "handles": ["handle1", "handle2"] }'
    );
    return;
  }

  console.log(`Scrapeando ${accounts.handles.length} cuentas de inspiración: ${accounts.handles.join(", ")}`);

  const directUrls = accounts.handles.map((h) => `https://www.instagram.com/${h}/`);

  const items = await runApifyActor<RawApifyReel>({
    actorId,
    token,
    input: {
      directUrls,
      resultsType: "reels",
      resultsLimit: RESULTS_LIMIT,
    },
  });

  const byHandle = new Map<string, RawApifyReel[]>();
  for (const item of items) {
    const handle = item.ownerUsername;
    if (!byHandle.has(handle)) byHandle.set(handle, []);
    byHandle.get(handle)!.push(item);
  }

  const scrapedAt = new Date().toISOString();

  for (const handle of accounts.handles) {
    const raw = byHandle.get(handle) ?? [];
    const result: InspirationScrapeResult = {
      handle,
      scrapedAt,
      reels: raw.map(toInspirationReel),
    };
    await writeData(`inspiration-reels/${handle}.json`, result);
    console.log(`  ${handle}: ${result.reels.length} reels -> data/inspiration-reels/${handle}.json`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
