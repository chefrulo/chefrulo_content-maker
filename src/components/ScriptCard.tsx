import Link from "next/link";
import { Badge } from "./ui/badge";
import type { ReelScript } from "@/types/reel-script";

const statusVariant: Record<ReelScript["status"], "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending_review: "warning",
  approved: "default",
  rejected: "destructive",
  published: "success",
};

const statusLabel: Record<ReelScript["status"], string> = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  published: "Publicado",
};

export function ScriptCard({ script }: { script: ReelScript }) {
  return (
    <Link
      href={`/scripts/${script.id}`}
      className="cr-enter block rounded-xl border border-border bg-surface p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline">{script.brandPillar}</Badge>
        <Badge variant={statusVariant[script.status] ?? "secondary"}>
          {statusLabel[script.status] ?? script.status}
        </Badge>
      </div>
      <p className="text-sm font-semibold leading-snug">{script.hook}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {script.editorialTerritory} · {script.contentPattern}
      </p>
    </Link>
  );
}
