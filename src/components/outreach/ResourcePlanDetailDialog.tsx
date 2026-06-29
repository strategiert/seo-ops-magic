import { useEffect } from "react";
import { Clipboard, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  formatResourcePlanBrief,
  type ResourcePlan,
} from "@/lib/outreach/resourcePlans";

type ResourcePlanDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourcePlan: ResourcePlan | null;
};

const scoreLabels: Array<[keyof ResourcePlan["formatScore"], string]> = [
  ["readerBenefit", "Leser-Nutzen"],
  ["editorialBenefit", "Redaktions-Nutzen"],
  ["linkReason", "Linkgrund"],
  ["credibility", "Glaubwürdigkeit"],
  ["effort", "Aufwand"],
  ["evergreen", "Evergreen"],
  ["dachFit", "DACH-Fit"],
  ["outreachFit", "Outreach-Fit"],
  ["total", "Gesamt"],
];

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(score, 1)) * 100)}%`;
}

function ListBlock({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Angabe</p>;
  }

  return (
    <ul className="min-w-0 space-y-1 text-sm">
      {items.map((item) => (
        <li key={item} className="max-w-full whitespace-normal break-words leading-5">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ResourcePlanDetailDialog({
  open,
  onOpenChange,
  resourcePlan,
}: ResourcePlanDetailDialogProps) {
  const { toast } = useToast();
  const dialogOpen = open && Boolean(resourcePlan);

  useEffect(() => {
    if (open && !resourcePlan) {
      onOpenChange(false);
    }
  }, [onOpenChange, open, resourcePlan]);

  if (!resourcePlan) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const fullBrief = formatResourcePlanBrief(resourcePlan);

  const copyText = async (label: string, text: string) => {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await globalThis.navigator.clipboard.writeText(text);
      toast({
        title: "Kopiert",
        description: `${label} wurde in die Zwischenablage kopiert.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Kopieren fehlgeschlagen",
        description: `${label} konnte nicht in die Zwischenablage kopiert werden.`,
      });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <DialogTitle className="max-w-full whitespace-normal break-words leading-6">
                {resourcePlan.publicName}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailansicht des Ressourcenplans mit Bewertung, Zielgruppen und
                Umsetzungsbrief.
              </DialogDescription>
              <div className="flex min-w-0 flex-wrap gap-2">
                <Badge className="max-w-full whitespace-normal break-words rounded-md text-left">
                  {formatScore(resourcePlan.formatScore.total)}
                </Badge>
                <Badge
                  variant="outline"
                  className="max-w-full whitespace-normal break-words rounded-md text-left"
                >
                  {resourcePlan.resourceType}
                </Badge>
                {resourcePlan.alternativeTypes.map((type) => (
                  <Badge
                    key={type}
                    variant="secondary"
                    className="max-w-full whitespace-normal break-words rounded-md text-left"
                  >
                    Alternative: {type}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => void copyText("Ressourcen-Plan", fullBrief)}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Alles kopieren
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(88vh-96px)]">
          <div className="space-y-6 px-6 py-5">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Leserzielgruppe
                </p>
                <p className="mt-1 max-w-full whitespace-normal break-words text-sm leading-6">
                  {resourcePlan.readerAudience || "Keine Angabe"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Leserproblem
                </p>
                <p className="mt-1 max-w-full whitespace-normal break-words text-sm leading-6">
                  {resourcePlan.readerProblem || "Keine Angabe"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Redaktioneller Wert
                </p>
                <p className="mt-1 max-w-full whitespace-normal break-words text-sm leading-6">
                  {resourcePlan.editorialValue || "Keine Angabe"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Linkgrund
                </p>
                <p className="mt-1 max-w-full whitespace-normal break-words text-sm leading-6">
                  {resourcePlan.linkReason || "Keine Angabe"}
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="font-medium">Bewertungsmatrix</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {scoreLabels.map(([key, label]) => (
                  <div key={key} className="rounded-md border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">
                      {formatScore(resourcePlan.formatScore[key])}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-medium">Linkzielgruppen</h3>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {resourcePlan.linkAudiences.length > 0 ? (
                    resourcePlan.linkAudiences.map((audience) => (
                      <Badge
                        key={audience}
                        variant="secondary"
                        className="max-w-full whitespace-normal break-words rounded-md text-left font-normal"
                      >
                        {audience}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Angabe
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium">MVP-Umfang</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.mvpScope} />
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-medium">Entkommerzialisierung</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.decommercialization} />
                </div>
              </div>
              <div>
                <h3 className="font-medium">Glaubwürdigkeitsplan</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.credibilityPlan} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-medium">Umsetzungsbrief</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyText("Umsetzungsbrief", resourcePlan.claudeCodeBrief)
                  }
                >
                  <Clipboard className="mr-2 h-4 w-4" />
                  Kopieren
                </Button>
              </div>
              <Textarea
                value={resourcePlan.claudeCodeBrief}
                readOnly
                className="min-h-[180px] resize-none text-sm"
              />
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Outreach-Rohmaterial</h3>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Warum diese Zielseite
                  </p>
                  <p className="mt-1 max-w-full whitespace-normal break-words leading-5">
                    {resourcePlan.outreachRawMaterial.whyThisSite ||
                      "Keine Angabe"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Platzierungsidee
                  </p>
                  <p className="mt-1 max-w-full whitespace-normal break-words leading-5">
                    {resourcePlan.outreachRawMaterial.placementIdea ||
                      "Keine Angabe"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Pitch-Winkel
                  </p>
                  <p className="mt-1 max-w-full whitespace-normal break-words leading-5">
                    {resourcePlan.outreachRawMaterial.pitchAngle ||
                      "Keine Angabe"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Suchoperatoren
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {resourcePlan.outreachRawMaterial.searchOperators.length >
                  0 ? (
                    resourcePlan.outreachRawMaterial.searchOperators.map(
                      (operator) => (
                        <Badge
                          key={operator}
                          variant="outline"
                          className="max-w-full break-all whitespace-normal rounded-md text-left"
                        >
                          {operator}
                        </Badge>
                      )
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Angabe
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
