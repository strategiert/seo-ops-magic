import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Search } from "lucide-react";
import { useQuery } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { BriefCreationWizard } from "@/components/briefs/BriefCreationWizard";
import { DataStateWrapper, EmptyState, CardGridSkeleton } from "@/components/data-state";
import { api } from "../../convex/_generated/api";

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const intentLabels: Record<string, string> = {
  informational: "Informational",
  transactional: "Transaktional",
  navigational: "Navigational",
  commercial: "Commercial Investigation",
};

export default function Briefs() {
  const navigate = useNavigate();
  const { currentProject } = useWorkspaceConvex();

  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  // Use Convex query for real-time briefs data
  const briefs = useQuery(
    api.tables.contentBriefs.listByProject,
    currentProject?._id ? { projectId: currentProject._id } : "skip"
  );

  const loading = briefs === undefined;

  const filteredBriefs = (briefs ?? []).filter(
    (brief) =>
      brief.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brief.primaryKeyword.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by creation time descending
  const sortedBriefs = [...filteredBriefs].sort(
    (a, b) => b._creationTime - a._creationTime
  );

  if (!currentProject) {
    return (
      <AppLayout>
        <EmptyState
          icon={FileText}
          title="Kein Projekt ausgewählt"
          description="Wähle zuerst ein Projekt aus, um Content Briefs zu verwalten."
          action={{
            label: "Zu den Projekten",
            onClick: () => navigate("/projects"),
          }}
          className="h-64"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Content Briefs</h1>
            <p className="text-muted-foreground">
              SEO-optimierte Briefings für {currentProject.name}
            </p>
          </div>

          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Brief
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Briefs durchsuchen..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Briefs List */}
        <DataStateWrapper
          isLoading={loading}
          data={sortedBriefs}
          skeleton={<CardGridSkeleton cards={6} />}
          emptyState={
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Keine Treffer" : "Noch keine Briefs"}
              description={
                searchQuery
                  ? "Versuche einen anderen Suchbegriff."
                  : "Erstelle dein erstes Content Brief, um loszulegen."
              }
              action={
                !searchQuery
                  ? {
                      label: "Erstes Brief erstellen",
                      onClick: () => setWizardOpen(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          }
        >
          {(briefs) => (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {briefs.map((brief) => (
                <Card
                  key={brief._id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/briefs/${brief._id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2">{brief.title}</CardTitle>
                      <Badge className={statusColors[brief.status || "draft"]} variant="secondary">
                        {brief.status || "draft"}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {brief.primaryKeyword}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {brief.searchIntent && (
                        <Badge variant="outline" className="text-xs">
                          {intentLabels[brief.searchIntent] || brief.searchIntent}
                        </Badge>
                      )}
                      {brief.targetLength && (
                        <span>{brief.targetLength} Wörter</span>
                      )}
                      {brief.nwGuidelines && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          NW
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DataStateWrapper>
      </div>

      {/* Brief Creation Wizard */}
      <BriefCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </AppLayout>
  );
}
