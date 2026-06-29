import { useEffect, useMemo, useState } from "react";
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
import { ResourcePlanCard } from "@/components/outreach/ResourcePlanCard";
import { ResourcePlanDetailDialog } from "@/components/outreach/ResourcePlanDetailDialog";
import {
  normalizeResourcePlan,
  sanitizePublicResourceText,
  type ResourcePlan,
} from "@/lib/outreach/resourcePlans";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type OutreachIntelligencePanelProps = {
  projectId: Id<"projects">;
  onOpenCampaign: (campaignId: string) => void;
  onManualCreate: () => void;
};

type Opportunity = {
  title: string;
  sourceKind: string;
  score: number;
  effort: string;
  resourcePlan: ResourcePlan;
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

const legacyResourceTypeLabels: Record<string, string> = {
  calculator: "Rechner / Kalkulator",
  checklist: "Checkliste",
  comparison: "Vergleichstest",
  faq: "FAQ",
  glossary: "Lexikon / Glossar",
  guide: "Ratgeber / Broschüre",
  infographic: "Interaktive Grafik / Diagramm",
  list: "Ressourcenliste",
  report: "Report / Whitepaper",
  resource_list: "Ressourcenliste",
  study: "Studie / Datenauswertung",
  tool: "Kostenloses Tool",
};

function buildLegacyResourcePlanInput(
  value: Record<string, unknown>,
  title: string
): Record<string, unknown> {
  const contentType = asString(value.contentType);
  const recommendedAssetUpgrade = asString(value.recommendedAssetUpgrade) || "";
  const outreachAngles = asStringArray(value.outreachAngles);
  const resourceType = contentType
    ? legacyResourceTypeLabels[contentType]
    : undefined;

  return {
    title,
    publicName: title,
    ...(resourceType ? { resourceType } : {}),
    editorialValue: recommendedAssetUpgrade,
    linkAudiences: asStringArray(value.audiences),
    linkReason: asStringArray(value.linkabilityReasons).join("; "),
    readerProblem: recommendedAssetUpgrade,
    outreachRawMaterial: {
      pitchAngle: outreachAngles[0] || "",
      searchOperators: asStringArray(value.searchOperators),
    },
  };
}

function normalizeOpportunity(value: unknown): Opportunity | null {
  if (!isRecord(value)) return null;

  const title = asString(value.title);
  if (!title) return null;
  const resourcePlan = normalizeResourcePlan(
    isRecord(value.resourcePlan)
      ? value.resourcePlan
      : buildLegacyResourcePlanInput(value, title),
    title
  );

  return {
    title,
    sourceKind: asString(value.sourceKind) || "new_asset",
    score: asNumber(value.score) ?? 0,
    effort: asString(value.effort) || "medium",
    resourcePlan,
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
  const [selectedPlan, setSelectedPlan] = useState<ResourcePlan | null>(null);
  const triggerIntelligence = useAction(
    api.agents.triggers.triggerOutreachIntelligence
  );
  const analysis = useQuery(api.tables.outreachIntelligence.latestByProject, {
    projectId,
  });

  useEffect(() => {
    setSelectedPlan(null);
  }, [projectId, analysis?._id]);

  const opportunities = useMemo(
    () => normalizeOpportunities(analysis?.opportunitiesJson),
    [analysis?.opportunitiesJson]
  );
  const counts = useMemo(
    () => getObservedCounts(analysis?.sourceCoverageJson),
    [analysis?.sourceCoverageJson]
  );
  const isQueued = analysis?.status === "queued";
  const isRunning = isStarting || isQueued || analysis?.status === "running";
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
          "Der Agent liest Projektkontext, Sitemap und Content und plant daraus verlinkbare Ressourcen.",
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
                  Analysiert Brand-Profil, Crawl, Content und Sitemap und plant
                  verlinkbare Ressourcen für Redaktionen, Blogs und Webmaster.
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
              {isQueued
                ? "Die Analyse steht in der Warteschlange und wird vom Outreach-Worker übernommen."
                : "Die KI sammelt Website-Struktur, vorhandene Inhalte und mögliche redaktionelle Ressourcen."}
            </span>
          </div>
          <Progress value={isQueued ? 12 : 42} />
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
                  {sanitizePublicResourceText(analysis.summary || "")}
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
                  verlinkbare Ressourcen aus vorhandenen Daten und neuen Asset-Ideen plant.
                </span>
              </div>
            </div>
          )}

          {opportunities.length > 0 && (
            <div className="divide-y rounded-md border">
              {opportunities.slice(0, 5).map((opportunity, index) => (
                <ResourcePlanCard
                  key={`${opportunity.title}-${index}`}
                  title={opportunity.title}
                  score={opportunity.score}
                  effort={opportunity.effort}
                  sourceKind={opportunity.sourceKind}
                  resourcePlan={opportunity.resourcePlan}
                  onOpen={() => setSelectedPlan(opportunity.resourcePlan)}
                />
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
      <ResourcePlanDetailDialog
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
        resourcePlan={selectedPlan}
      />
    </section>
  );
}
