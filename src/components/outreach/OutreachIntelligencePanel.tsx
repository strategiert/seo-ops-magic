import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  FileSearch,
  Loader2,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type OutreachIntelligencePanelProps = {
  projectId: Id<"projects">;
  onOpenCampaign: (campaignId: string) => void;
  onManualCreate: () => void;
};

type Opportunity = {
  title: string;
  contentType: string;
  sourceKind: string;
  sourceUrl?: string;
  score: number;
  effort: string;
  linkabilityReasons: string[];
  audiences: string[];
  recommendedAssetUpgrade: string;
  outreachAngles: string[];
  searchOperators: string[];
  campaignName: string;
};

type ObservedCounts = {
  crawlPages?: number;
  articles?: number;
  briefs?: number;
  htmlExports?: number;
  contentAssets?: number;
  dashboardPages?: number;
  sitemapUrls?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeOpportunity(value: unknown): Opportunity | null {
  if (!isRecord(value)) return null;

  const title = asString(value.title);
  if (!title) return null;

  return {
    title,
    contentType: asString(value.contentType) || "other",
    sourceKind: asString(value.sourceKind) || "new_asset",
    sourceUrl: asString(value.sourceUrl),
    score: asNumber(value.score) ?? 0,
    effort: asString(value.effort) || "medium",
    linkabilityReasons: asStringArray(value.linkabilityReasons),
    audiences: asStringArray(value.audiences),
    recommendedAssetUpgrade: asString(value.recommendedAssetUpgrade) || "",
    outreachAngles: asStringArray(value.outreachAngles),
    searchOperators: asStringArray(value.searchOperators),
    campaignName: asString(value.campaignName) || `${title} Outreach`,
  };
}

function normalizeOpportunities(value: unknown): Opportunity[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeOpportunity)
    .filter((item): item is Opportunity => Boolean(item))
    .sort((a, b) => b.score - a.score);
}

function getObservedCounts(value: unknown): ObservedCounts {
  if (!isRecord(value) || !isRecord(value.observedCounts)) return {};

  return {
    crawlPages: asNumber(value.observedCounts.crawlPages),
    articles: asNumber(value.observedCounts.articles),
    briefs: asNumber(value.observedCounts.briefs),
    htmlExports: asNumber(value.observedCounts.htmlExports),
    contentAssets: asNumber(value.observedCounts.contentAssets),
    dashboardPages: asNumber(value.observedCounts.dashboardPages),
    sitemapUrls: asNumber(value.observedCounts.sitemapUrls),
  };
}

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(score, 1)) * 100)}%`;
}

const sourceLabels: Array<[keyof ObservedCounts, string]> = [
  ["crawlPages", "Crawl"],
  ["articles", "Artikel"],
  ["briefs", "Briefs"],
  ["htmlExports", "HTML"],
  ["contentAssets", "Assets"],
  ["dashboardPages", "Dashboard"],
  ["sitemapUrls", "Sitemap"],
];

export function OutreachIntelligencePanel({
  projectId,
  onOpenCampaign,
  onManualCreate,
}: OutreachIntelligencePanelProps) {
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const triggerIntelligence = useAction(
    api.agents.triggers.triggerOutreachIntelligence
  );
  const analysis = useQuery(api.tables.outreachIntelligence.latestByProject, {
    projectId,
  });

  const opportunities = useMemo(
    () => normalizeOpportunities(analysis?.opportunitiesJson),
    [analysis?.opportunitiesJson]
  );
  const counts = useMemo(
    () => getObservedCounts(analysis?.sourceCoverageJson),
    [analysis?.sourceCoverageJson]
  );
  const isRunning = isStarting || analysis?.status === "running";
  const hasCompletedAnalysis = analysis?.status === "completed";

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const result = await triggerIntelligence({ projectId });

      if (!result.success) {
        throw new Error(result.error || "Analyse konnte nicht gestartet werden.");
      }

      toast({
        title: "KI-Analyse gestartet",
        description:
          "Der Agent liest Projektkontext, Sitemap und Content und legt danach eine Kampagne an.",
      });
    } catch (error) {
      console.error("Error starting outreach intelligence:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error
            ? error.message
            : "Die Outreach-Analyse konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border bg-background">
      <div className="border-b bg-muted/30 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">KI Outreach Intelligence</h2>
                <p className="text-sm text-muted-foreground">
                  Analysiert Brand-Profil, Crawl, Content, Integrationen und Sitemap
                  und erzeugt daraus eine fertige Outreach-Kampagne.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStart}
              disabled={isRunning}
              className="min-w-[178px]"
            >
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isRunning ? "Analysiere..." : "KI analysieren"}
            </Button>
            <Button variant="outline" onClick={onManualCreate}>
              <Wand2 className="mr-2 h-4 w-4" />
              Manuell anlegen
            </Button>
          </div>
        </div>
      </div>

      {isRunning ? (
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3 text-sm">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            <span>
              Die KI sammelt Website-Struktur, vorhandene Inhalte und mögliche
              Linkbait-Assets.
            </span>
          </div>
          <Progress value={42} />
        </div>
      ) : analysis?.status === "failed" ? (
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium">Analyse fehlgeschlagen</p>
              <p className="text-sm text-muted-foreground">
                {analysis.errorMessage || "Bitte starte die Analyse erneut."}
              </p>
            </div>
          </div>
          <Button onClick={handleStart}>
            <Sparkles className="mr-2 h-4 w-4" />
            Erneut starten
          </Button>
        </div>
      ) : (
        <div className="space-y-5 px-5 py-5">
          {hasCompletedAnalysis ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Letzte KI-Auswertung
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {analysis.summary}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sourceLabels.map(([key, label]) => (
                    <Badge
                      key={key}
                      variant="secondary"
                      className="rounded-md font-normal"
                    >
                      {label}: {counts[key] ?? 0}
                    </Badge>
                  ))}
                </div>
              </div>

              {analysis.createdCampaignId && (
                <Button
                  variant="outline"
                  onClick={() => onOpenCampaign(analysis.createdCampaignId)}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Generierte Kampagne öffnen
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <FileSearch className="h-4 w-4" />
                <span>
                  Noch keine KI-Auswertung. Starte die Analyse, damit die KI
                  Linkbait-Potenziale aus vorhandenen Daten findet.
                </span>
              </div>
            </div>
          )}

          {opportunities.length > 0 && (
            <div className="divide-y rounded-md border">
              {opportunities.slice(0, 4).map((opportunity, index) => (
                <div key={`${opportunity.title}-${index}`} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-md">
                          {formatScore(opportunity.score)}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                          {opportunity.contentType}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                          {opportunity.sourceKind}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md">
                          Aufwand: {opportunity.effort}
                        </Badge>
                      </div>
                      <h3 className="font-semibold">{opportunity.title}</h3>
                      {opportunity.recommendedAssetUpgrade && (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {opportunity.recommendedAssetUpgrade}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Warum linkbar
                      </p>
                      <ul className="space-y-1 text-sm">
                        {opportunity.linkabilityReasons.slice(0, 3).map((reason) => (
                          <li key={reason} className="leading-5">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Zielgruppen
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {opportunity.audiences.slice(0, 5).map((audience) => (
                          <Badge
                            key={audience}
                            variant="secondary"
                            className="rounded-md font-normal"
                          >
                            {audience}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        Outreach-Winkel
                      </p>
                      <ul className="space-y-1 text-sm">
                        {opportunity.outreachAngles.slice(0, 3).map((angle) => (
                          <li key={angle} className="leading-5">
                            {angle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasCompletedAnalysis && analysis.createdCampaignId && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => onOpenCampaign(analysis.createdCampaignId)}
            >
              Nächster Schritt
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
