export interface ReelBrief {
  id: string;
  createdAt: string;
  pillar: string;
  format: string;
  hook: string;
  script: string[];
  cta: string;
  estimatedDurationSeconds: number;
  inspiredBy: string[];
  status: "pending_review" | "approved" | "rejected";
}
