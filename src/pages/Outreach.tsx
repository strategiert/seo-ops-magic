import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Send, Target } from "lucide-react";
import { useQuery } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/data-state";
import { CreateCampaignDialog } from "@/components/outreach/CreateCampaignDialog";
import { OutreachIntelligencePanel } from "@/components/outreach/OutreachIntelligencePanel";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { useProjectPrefix } from "@/hooks/useProjectPrefix";
import { api } from "../../convex/_generated/api";

const statusLabels: Record<string, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  active: "Aktiv",
  paused: "Pausiert",
  review: "Review",
  done: "Abgeschlossen",
};

const statusClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ready: "bg-blue-500/20 text-blue-700",
  active: "bg-green-500/20 text-green-700",
  paused: "bg-yellow-500/20 text-yellow-700",
  review: "bg-orange-500/20 text-orange-700",
  done: "bg-zinc-500/20 text-zinc-700",
};

const campaignTypeLabels: Record<string, string> = {
  linkbuilding: "Linkbuilding",
  pr: "PR",
  sales: "Sales",
  partnership: "Partnership",
  seeding: "Seeding",
};

export default function Outreach() {
  const navigate = useNavigate();
  const prefix = useProjectPrefix();
  const { currentProject } = useWorkspaceConvex();
  const [createOpen, setCreateOpen] = useState(false);

  const campaignsData = useQuery(
    api.tables.outreach.listCampaigns,
    currentProject?._id ? { projectId: currentProject._id } : "skip"
  );

  const loading = campaignsData === undefined;

  const sortedCampaigns = useMemo(() => {
    return [...(campaignsData ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [campaignsData]);

  const activeCount = sortedCampaigns.filter((campaign) => campaign.status === "active").length;
  const readyCount = sortedCampaigns.filter((campaign) => campaign.status === "ready").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">KI Outreach</h1>
            <p className="text-muted-foreground">
              Die KI findet Linkbait-, PR- und Sales-Aufhänger aus vorhandenem Content.
            </p>
          </div>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Manuell
          </Button>
        </div>

        {currentProject?._id && (
          <OutreachIntelligencePanel
            projectId={currentProject._id}
            onOpenCampaign={(campaignId) => navigate(`${prefix}/outreach/${campaignId}`)}
            onManualCreate={() => setCreateOpen(true)}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Kampagnen</p>
            <p className="text-2xl font-semibold">{sortedCampaigns.length}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Aktiv</p>
            <p className="text-2xl font-semibold">{activeCount}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Bereit</p>
            <p className="text-2xl font-semibold">{readyCount}</p>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : sortedCampaigns.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Noch keine generierten Kampagnen"
            description="Starte oben die KI-Analyse. Der Agent bewertet Content, Sitemap und Brand-Daten und legt danach eine Kampagne an."
          />
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ziele</TableHead>
                  <TableHead className="text-right">Aktualisiert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.map((campaign) => (
                  <TableRow
                    key={campaign._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`${prefix}/outreach/${campaign._id}`)}
                  >
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.targetDomain || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClasses[campaign.status] || statusClasses.draft}>
                        {statusLabels[campaign.status] || campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Target className="h-4 w-4" />
                        <span>{campaign.goalTargetsJson ? "Definiert" : "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(campaign.updatedAt).toLocaleDateString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(campaignId) => navigate(`${prefix}/outreach/${campaignId}`)}
      />
    </AppLayout>
  );
}
