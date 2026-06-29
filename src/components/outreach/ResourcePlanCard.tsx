import { ArrowRight, FileText, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResourcePlan } from "@/lib/outreach/resourcePlans";

type ResourcePlanCardProps = {
  title: string;
  score: number;
  effort: string;
  sourceKind: string;
  resourcePlan: ResourcePlan;
  onOpen: () => void;
};

const sourceKindLabels: Record<string, string> = {
  article: "Artikel",
  brief: "Brief",
  content_asset: "Asset",
  crawl_page: "Crawl-Seite",
  html_export: "HTML",
  new_asset: "Neue Ressource",
  sitemap_url: "Sitemap",
};

const effortLabels: Record<string, string> = {
  high: "hoch",
  low: "niedrig",
  medium: "mittel",
};

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(score, 1)) * 100)}%`;
}

function formatSourceKind(sourceKind: string): string {
  return sourceKindLabels[sourceKind] || sourceKind;
}

function formatEffort(effort: string): string {
  return effortLabels[effort] || effort;
}

export function ResourcePlanCard({
  title,
  score,
  effort,
  sourceKind,
  resourcePlan,
  onOpen,
}: ResourcePlanCardProps) {
  return (
    <div className="min-w-0 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className="max-w-full whitespace-normal break-words rounded-md text-left">
              {formatScore(score)}
            </Badge>
            <Badge
              variant="outline"
              className="max-w-full whitespace-normal break-words rounded-md text-left"
            >
              {resourcePlan.resourceType}
            </Badge>
            <Badge
              variant="outline"
              className="max-w-full whitespace-normal break-words rounded-md text-left"
            >
              {formatSourceKind(sourceKind)}
            </Badge>
            <Badge
              variant="secondary"
              className="max-w-full whitespace-normal break-words rounded-md text-left"
            >
              Aufwand: {formatEffort(effort)}
            </Badge>
          </div>

          <div className="min-w-0">
            <h3 className="max-w-full whitespace-normal break-words font-semibold leading-6">
              {resourcePlan.publicName || title}
            </h3>
            {resourcePlan.editorialValue && (
              <p className="mt-1 max-w-full whitespace-normal break-words text-sm leading-6 text-muted-foreground">
                {resourcePlan.editorialValue}
              </p>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={onOpen} className="shrink-0">
          Plan öffnen
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Leserproblem
          </div>
          <p className="max-w-full whitespace-normal break-words text-sm leading-5">
            {resourcePlan.readerProblem || "Noch kein Leserproblem angegeben."}
          </p>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Linkzielgruppen
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {resourcePlan.linkAudiences.length > 0 ? (
              resourcePlan.linkAudiences.slice(0, 5).map((audience) => (
                <Badge
                  key={audience}
                  variant="secondary"
                  className="max-w-full whitespace-normal break-words rounded-md text-left font-normal"
                >
                  {audience}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Keine Angabe</p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Linkgrund
          </div>
          <p className="max-w-full whitespace-normal break-words text-sm leading-5">
            {resourcePlan.linkReason || "Noch kein Linkgrund angegeben."}
          </p>
        </div>
      </div>
    </div>
  );
}
