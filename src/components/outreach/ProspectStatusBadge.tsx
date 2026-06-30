import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  new: "Neu",
  qualified: "Qualifiziert",
  contacted: "Kontaktiert",
  replied: "Antwort",
  won: "Gewonnen",
  lost: "Verloren",
  suppressed: "Gesperrt",
  missing: "Fehlt",
  found: "Gefunden",
  unverified: "KI-Vorschlag",
  verified: "Geprueft",
  bad: "Ungueltig",
};

const statusClasses: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  qualified: "bg-blue-500/20 text-blue-700",
  contacted: "bg-yellow-500/20 text-yellow-700",
  replied: "bg-orange-500/20 text-orange-700",
  won: "bg-green-500/20 text-green-700",
  lost: "bg-red-500/20 text-red-700",
  suppressed: "bg-zinc-500/20 text-zinc-700",
  missing: "bg-muted text-muted-foreground",
  found: "bg-sky-500/20 text-sky-700",
  unverified: "bg-amber-500/20 text-amber-700",
  verified: "bg-emerald-500/20 text-emerald-700",
  bad: "bg-red-500/20 text-red-700",
};

export function ProspectStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusClasses[status] || statusClasses.new}>
      {statusLabels[status] || status}
    </Badge>
  );
}
