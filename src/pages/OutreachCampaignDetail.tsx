import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Plus, Upload } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OutreachStats } from "@/components/outreach/OutreachStats";
import { ProspectImportDialog } from "@/components/outreach/ProspectImportDialog";
import { ProspectStatusBadge } from "@/components/outreach/ProspectStatusBadge";
import { SequenceEditor } from "@/components/outreach/SequenceEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useProjectPrefix } from "@/hooks/useProjectPrefix";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const prospectStatuses = [
  "new",
  "qualified",
  "contacted",
  "replied",
  "won",
  "lost",
  "suppressed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function StrategyPanel({ strategyJson }: { strategyJson: unknown }) {
  if (!isRecord(strategyJson)) {
    return (
      <div className="border rounded-lg p-6 text-muted-foreground">
        Noch keine Strategie generiert.
      </div>
    );
  }

  const summary = typeof strategyJson.summary === "string" ? strategyJson.summary : "";
  const positioning =
    typeof strategyJson.positioning === "string" ? strategyJson.positioning : "";
  const recommendedMethods = asStringArray(strategyJson.recommendedMethods);
  const searchOperators = asStringArray(strategyJson.searchOperators);
  const risks = asStringArray(strategyJson.risks);
  const nextActions = asStringArray(strategyJson.nextActions);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Strategie</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {summary || "Keine Zusammenfassung vorhanden."}
        </p>
        {positioning && (
          <p className="text-sm whitespace-pre-wrap">{positioning}</p>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Methoden</h3>
        <div className="flex flex-wrap gap-2">
          {recommendedMethods.length > 0 ? (
            recommendedMethods.map((method) => (
              <Badge key={method} variant="secondary">
                {method}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Keine Methoden</span>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Suchoperatoren</h3>
        <div className="space-y-2">
          {searchOperators.length > 0 ? (
            searchOperators.map((operator) => (
              <code key={operator} className="block rounded bg-muted px-2 py-1 text-sm">
                {operator}
              </code>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Keine Operatoren</span>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Review</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Risiken</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Naechste Schritte</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutreachCampaignDetail() {
  const { campaignId } = useParams();
  const prefix = useProjectPrefix();
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [goalForm, setGoalForm] = useState({
    goalType: "backlink",
    targetUrl: "",
    sourceUrl: "",
    description: "",
  });

  const typedCampaignId = campaignId as Id<"outreachCampaigns"> | undefined;

  const bundle = useQuery(
    api.tables.outreach.getCampaignBundle,
    typedCampaignId ? { campaignId: typedCampaignId } : "skip"
  );
  const stats = useQuery(
    api.tables.outreach.prospectStats,
    typedCampaignId ? { campaignId: typedCampaignId } : "skip"
  );

  const triggerOutreachStrategy = useAction(api.agents.triggers.triggerOutreachStrategy);
  const updateProspect = useMutation(api.tables.outreach.updateProspect);
  const createGoal = useMutation(api.tables.outreach.createGoal);

  const sortedProspects = useMemo(() => {
    return [...(bundle?.prospects ?? [])].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });
  }, [bundle?.prospects]);

  const sequence = useMemo(() => {
    return [...(bundle?.sequences ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  }, [bundle?.sequences]);

  if (bundle === undefined) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Kampagne...
        </div>
      </AppLayout>
    );
  }

  if (!bundle || !typedCampaignId) {
    return (
      <AppLayout>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Kampagne nicht gefunden</h1>
          <Button variant="outline" asChild>
            <Link to={`${prefix}/outreach`}>Zurueck zu Outreach</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      const result = await triggerOutreachStrategy({ campaignId: typedCampaignId });
      if (!result.success) {
        throw new Error(result.error || "Strategy trigger failed");
      }

      toast({
        title: "Strategie gestartet",
        description: result.eventId ? `Event: ${result.eventId}` : "Der Agent laeuft.",
      });
    } catch (error) {
      console.error("Error triggering outreach strategy:", error);
      toast({
        title: "Start fehlgeschlagen",
        description: "Die Strategie konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProspectStatus = async (
    prospectId: Id<"outreachProspects">,
    status: string
  ) => {
    await updateProspect({ prospectId, status });
  };

  const handleCreateGoal = async () => {
    await createGoal({
      campaignId: typedCampaignId,
      goalType: goalForm.goalType,
      targetUrl: goalForm.targetUrl.trim() || undefined,
      sourceUrl: goalForm.sourceUrl.trim() || undefined,
      description: goalForm.description.trim() || undefined,
    });
    setGoalForm({
      goalType: "backlink",
      targetUrl: "",
      sourceUrl: "",
      description: "",
    });
    toast({
      title: "Ziel erfasst",
      description: "Das Outreach-Ziel wurde angelegt.",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{bundle.campaign.name}</h1>
              <Badge variant="secondary">{bundle.campaign.campaignType}</Badge>
            </div>
            <p className="text-muted-foreground">
              {bundle.campaign.targetDomain || "Keine Ziel-Domain gesetzt"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Prospects importieren
            </Button>
            <Button onClick={handleGenerateStrategy} disabled={isGenerating}>
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isGenerating ? "Startet..." : "Strategie generieren"}
            </Button>
          </div>
        </div>

        <OutreachStats stats={stats} />

        <Tabs defaultValue="strategy" className="space-y-4">
          <TabsList>
            <TabsTrigger value="strategy">Strategie</TabsTrigger>
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
            <TabsTrigger value="sequence">Sequenz</TabsTrigger>
            <TabsTrigger value="goals">Ziele</TabsTrigger>
          </TabsList>

          <TabsContent value="strategy">
            <StrategyPanel strategyJson={bundle.campaign.strategyJson} />
          </TabsContent>

          <TabsContent value="prospects">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Methode</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Begruendung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProspects.map((prospect) => (
                    <TableRow key={prospect._id}>
                      <TableCell>
                        <div className="font-medium">{prospect.domain}</div>
                        {prospect.url && (
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {prospect.url}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{prospect.method || "-"}</TableCell>
                      <TableCell>
                        {typeof prospect.score === "number"
                          ? prospect.score.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {prospect.tier ? <Badge variant="outline">{prospect.tier}</Badge> : "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={prospect.status}
                          onValueChange={(status) => handleProspectStatus(prospect._id, status)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>
                              <ProspectStatusBadge status={prospect.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {prospectStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                        <span className="line-clamp-2">{prospect.reasoning || "-"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="sequence">
            <SequenceEditor campaignId={typedCampaignId} sequence={sequence} />
          </TabsContent>

          <TabsContent value="goals">
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Typ</TableHead>
                      <TableHead>Ziel</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.goals.map((goal) => (
                      <TableRow key={goal._id}>
                        <TableCell>{goal.goalType}</TableCell>
                        <TableCell>{goal.targetUrl || goal.description || "-"}</TableCell>
                        <TableCell>{goal.sourceUrl || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{goal.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Ziel erfassen</h3>
                <div className="space-y-2">
                  <Label htmlFor="goal-type">Typ</Label>
                  <Select
                    value={goalForm.goalType}
                    onValueChange={(goalType) =>
                      setGoalForm((current) => ({ ...current, goalType }))
                    }
                  >
                    <SelectTrigger id="goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlink">Backlink</SelectItem>
                      <SelectItem value="press_mention">Press Mention</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-url">Ziel-URL</Label>
                  <Input
                    id="target-url"
                    value={goalForm.targetUrl}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        targetUrl: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-url">Quell-URL</Label>
                  <Input
                    id="source-url"
                    value={goalForm.sourceUrl}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        sourceUrl: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-description">Notiz</Label>
                  <Textarea
                    id="goal-description"
                    value={goalForm.description}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                  />
                </div>
                <Button onClick={handleCreateGoal} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ziel anlegen
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ProspectImportDialog
        campaignId={typedCampaignId}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </AppLayout>
  );
}
