import Link from "next/link";
import { Badge } from "./ui/badge";
import type { ContentBrief } from "@/types/content-brief";

const statusVariant: Record<ContentBrief["status"], "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending_review: "warning",
  approved: "default",
  rejected: "destructive",
};

const statusLabel: Record<ContentBrief["status"], string> = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export function ContentBriefCard({ brief }: { brief: ContentBrief }) {
  return (
    <Link
      href={`/content-briefs/${brief.id}`}
      className="cr-enter block rounded-xl border border-border bg-surface p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline">{brief.brandPillar}</Badge>
        <Badge variant={statusVariant[brief.status] ?? "secondary"}>
          {statusLabel[brief.status] ?? brief.status}
        </Badge>
      </div>
      <p className="text-sm font-semibold leading-snug">{brief.hook}</p>
      <p className="text-xs text-muted-foreground mt-1">{brief.editorialTerritory}</p>
    </Link>
  );
}
