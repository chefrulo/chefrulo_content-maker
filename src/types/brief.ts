export interface ReelBeat {
  visual: string;
  onScreenText?: string;
  voiceover?: string;
  estimatedSeconds: number;
}

export interface ReelBrief {
  id: string;
  createdAt: string;
  brandPillar: string;
  editorialTerritory: string;
  topic: string;
  contentPattern: string;
  hook: string;
  beats: ReelBeat[];
  cta: string;
  estimatedDurationSeconds: number;
  inspiredBy: string[];
  status: "pending_review" | "approved" | "rejected" | "published";
  publishedAt?: string;
  publishedMediaId?: string;
  publishedVideoUrl?: string;
}
