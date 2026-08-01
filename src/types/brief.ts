export interface ReelBeat {
  visual: string;
  onScreenText?: string;
  voiceover?: string;
  estimatedSeconds: number;
}

export interface ReelBrief {
  id: string;
  createdAt: string;
  pillar: string;
  format: string;
  hook: string;
  beats: ReelBeat[];
  cta: string;
  estimatedDurationSeconds: number;
  inspiredBy: string[];
  status: "pending_review" | "approved" | "rejected";
}
