export interface InspirationAccountsConfig {
  handles: string[];
}

export interface InspirationReel {
  shortCode: string;
  url: string;
  caption: string;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  videoViewCount: number | null;
  videoPlayCount: number | null;
  videoUrl: string | null;
  displayUrl: string | null;
  videoDuration: number | null;
  musicTitle: string | null;
  musicArtist: string | null;
  timestamp: string;
}

export interface InspirationScrapeResult {
  handle: string;
  scrapedAt: string;
  reels: InspirationReel[];
}
