export interface ContentBrief {
  id: string;
  ideaId: string;
  ideaText: string;
  sourceArticleId: string;
  sourceArticleSlug: string;
  brandBrainRevision: string;
  brandPillar: string;
  editorialTerritory: string;
  hook: string;
  coreMessage: string;
  culturalInsight: string;
  personalStory?: string;
  educationalValue: string;
  cta: string;
  status: "pending_review" | "approved" | "rejected";
  createdAt: string;
  reelScriptId?: string;
}
