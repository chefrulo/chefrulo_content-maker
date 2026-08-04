import type { IdeaStatus } from "@/lib/idea-library";

export type ArticleReviewStatus = "draft" | "review" | "approved" | "published";

export interface BrandBrainReviewIdea {
  id: string;
  title: string;
  question: string;
  coreInsight: string;
  whyItMatters?: string;
  status: IdeaStatus;
  signatureIdea: boolean;
}

export interface BrandBrainReviewArticle {
  id: string;
  slug: string;
  title: string;
  status: ArticleReviewStatus;
  primaryTerritory?: string;
  body: string;
  ideas: BrandBrainReviewIdea[];
}

export interface BrandBrainReviewSnapshot {
  revision: string;
  clean: boolean;
  articles: BrandBrainReviewArticle[];
}

export interface ApproveEditorialSelection {
  approveArticle: boolean;
  ideaIds: string[];
}

export interface EditorialApprovalResult {
  commit: string;
  articleApproved: boolean;
  approvedIdeaIds: string[];
}
