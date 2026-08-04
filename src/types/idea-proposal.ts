export type ProposedIdeaStatus = "pending_review" | "promoted" | "rejected";

export interface ProposedIdea {
  id: string;
  title: string;
  question: string;
  coreInsight: string;
  whyItMatters: string;
  status: ProposedIdeaStatus;
  promotedAt?: string;
}

export interface IdeaProposalBatch {
  id: string;
  createdAt: string;
  sourceArticleId: string;
  sourceArticleSlug: string;
  sourceArticleHash: string;
  brandBrainRevision: string;
  status: "pending_review" | "partially_promoted" | "promoted" | "rejected";
  ideas: ProposedIdea[];
}
