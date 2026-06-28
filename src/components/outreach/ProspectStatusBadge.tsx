import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  new: "Neu",
  qualified: "Qualifiziert",
  contacted: "Kontaktiert",
  replied: "Antwort",
  won: "Gewonnen",
  lost: "Verloren",
  suppressed: "Gesperrt",
};

const statusClasses: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  qualified: "bg-blue-500/20 text-blue-700",
  contacted: "bg-yellow-500/20 text-yellow-700",
  replied: "bg-orange-500/20 text-orange-700",
  won: "bg-green-500/20 text-green-700",
  lost: "bg-red-500/20 text-red-700",
  suppressed: "bg-zinc-500/20 text-zinc-700",
};

export function ProspectStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusClasses[status] || statusClasses.new}>
      {statusLabels[status] || status}
    </Badge>
  );
}
