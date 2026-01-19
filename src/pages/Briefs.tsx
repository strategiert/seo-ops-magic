import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { BriefCreationWizard } from "@/components/briefs/BriefCreationWizard";
import { DataStateWrapper, EmptyState, CardGridSkeleton } from "@/components/data-state";

interface ContentBrief {
  id: string;
  title: string;
  primary_keyword: string;
  search_intent: string | null;
  status: string | null;
  priority_score: number | null;
  target_length: number | null;
  created_at: string;
  nw_guidelines: unknown | null;
}

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
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();
  
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (currentProject?._id) {
      loadBriefs();
    }
  }, [currentProject?._id, page]);

  const loadBriefs = async () => {
    if (!currentProject?._id) return;

    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get count
      const { count } = await supabase
        .from("content_briefs")
        .select("*", { count: "exact", head: true })
        .eq("project_id", currentProject._id);

      setTotalCount(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from("content_briefs")
        .select("*")
        .eq("project_id", currentProject._id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setBriefs(data || []);
    } catch (error) {
      console.error("Error loading briefs:", error);
      toast({
        title: "Fehler beim Laden",
        description: "Content Briefs konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Refetch briefs when wizard closes (in case new brief was created)
  const handleWizardChange = (open: boolean) => {
    setWizardOpen(open);
    if (!open) {
      loadBriefs();
    }
  };

  const filteredBriefs = briefs.filter(
    (brief) =>
      brief.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brief.primary_keyword.toLowerCase().includes(searchQuery.toLowerCase())
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
          data={filteredBriefs}
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
                  key={brief.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/briefs/${brief.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2">{brief.title}</CardTitle>
                      <Badge className={statusColors[brief.status || "draft"]} variant="secondary">
                        {brief.status || "draft"}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {brief.primary_keyword}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {brief.search_intent && (
                        <Badge variant="outline" className="text-xs">
                          {intentLabels[brief.search_intent] || brief.search_intent}
                        </Badge>
                      )}
                      {brief.target_length && (
                        <span>{brief.target_length} Wörter</span>
                      )}
                      {brief.nw_guidelines && (
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

        {/* Pagination Controls */}
        {!loading && filteredBriefs.length > 0 && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border rounded-lg">
            <div className="text-sm text-muted-foreground">
              Zeige {page * PAGE_SIZE + 1} bis {Math.min((page + 1) * PAGE_SIZE, totalCount)} von {totalCount} Briefs
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </Button>
              <div className="text-sm text-muted-foreground">
                Seite {page + 1} von {Math.ceil(totalCount / PAGE_SIZE)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Brief Creation Wizard */}
      <BriefCreationWizard 
        open={wizardOpen} 
        onOpenChange={handleWizardChange} 
      />
    </AppLayout>
  );
}
