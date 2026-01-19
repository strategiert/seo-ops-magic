import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Loader2, Globe, CheckCircle2, XCircle, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataStateWrapper, EmptyState, TableSkeleton } from "@/components/data-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWordPressBulkPublish } from "@/hooks/useWordPress";

interface Article {
  id: string;
  title: string;
  primary_keyword: string | null;
  status: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
  brief_id: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-yellow-500/20 text-yellow-700",
  approved: "bg-blue-500/20 text-blue-700",
  published: "bg-green-500/20 text-green-700",
};

const statusLabels: Record<string, string> = {
  draft: "Entwurf",
  review: "Review",
  approved: "Freigegeben",
  published: "Veröffentlicht",
};

export default function Articles() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  const { publishing, results, publishMultiple } = useWordPressBulkPublish();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"publish" | "draft">("draft");
  const [bulkUseStyledHtml, setBulkUseStyledHtml] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map((a) => a.id)));
    }
  };

  const handleBulkPublish = async () => {
    const articleIds = Array.from(selectedIds);
    const publishResults = await publishMultiple(articleIds, {
      status: bulkStatus,
      useStyledHtml: bulkUseStyledHtml,
    });

    const successCount = Array.from(publishResults.values()).filter((r) => r.success).length;
    const failCount = articleIds.length - successCount;

    if (failCount === 0) {
      toast({
        title: "Alle Artikel übertragen",
        description: `${successCount} Artikel wurden zu WordPress übertragen.`,
      });
      setBulkPublishOpen(false);
      setSelectedIds(new Set());
      loadArticles();
    } else {
      toast({
        title: "Teilweise fehlgeschlagen",
        description: `${successCount} erfolgreich, ${failCount} fehlgeschlagen.`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentProject?.id) {
      loadArticles();
    }
  }, [currentProject?.id, page]);

  const loadArticles = async () => {
    if (!currentProject?.id) return;

    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get count
      const { count } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("project_id", currentProject.id);

      setTotalCount(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("project_id", currentProject.id)
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error("Error loading articles:", error);
      toast({
        title: "Fehler",
        description: "Artikel konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoize article map for O(1) lookup in bulk publish dialog
  const articleMap = useMemo(() => {
    return new Map(articles.map((a) => [a.id, a]));
  }, [articles]);

  // Memoize formatted dates to avoid creating Date objects on every render
  const formattedDates = useMemo(() => {
    return new Map(
      articles.map((a) => [a.id, new Date(a.updated_at).toLocaleDateString("de-DE")])
    );
  }, [articles]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Artikel</h1>
            <p className="text-muted-foreground">
              Generierte und bearbeitete Artikel
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} ausgewählt
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkPublishOpen(true)}
              >
                <Globe className="h-4 w-4 mr-2" />
                Zu WordPress
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Auswahl aufheben
              </Button>
            </div>
          )}
        </div>

        <DataStateWrapper
          isLoading={loading}
          data={articles}
          skeleton={<TableSkeleton rows={5} />}
          emptyState={
            <EmptyState
              icon={FileText}
              title="Keine Artikel vorhanden"
              description="Artikel werden aus Content Briefs generiert."
              action={{
                label: "Zu den Briefs",
                onClick: () => navigate("/briefs"),
                icon: Plus,
              }}
            />
          }
        >
          {(articles) => (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === articles.length && articles.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Aktualisiert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow
                      key={article.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/articles/${article.id}`)}
                    >
                      <TableCell onClick={(e) => toggleSelect(article.id, e)}>
                        <Checkbox checked={selectedIds.has(article.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {article.primary_keyword || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[article.status || "draft"]}>
                          {statusLabels[article.status || "draft"]}
                        </Badge>
                      </TableCell>
                      <TableCell>v{article.version || 1}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formattedDates.get(article.id)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination Controls */}
              {totalCount > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Zeige {page * PAGE_SIZE + 1} bis {Math.min((page + 1) * PAGE_SIZE, totalCount)} von {totalCount} Artikeln
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
          )}
        </DataStateWrapper>
      </div>

      {/* Bulk Publish Dialog */}
      <Dialog open={bulkPublishOpen} onOpenChange={setBulkPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {selectedIds.size} Artikel zu WordPress übertragen
            </DialogTitle>
            <DialogDescription>
              Die ausgewählten Artikel werden zu WordPress übertragen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as "publish" | "draft")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Als Entwurf speichern</SelectItem>
                  <SelectItem value="publish">Sofort veröffentlichen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Styled HTML Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="bulk-styled-html" className="cursor-pointer">Design verwenden</Label>
                  <p className="text-xs text-muted-foreground">
                    AI generiert gestyltes HTML
                  </p>
                </div>
              </div>
              <Switch
                id="bulk-styled-html"
                checked={bulkUseStyledHtml}
                onCheckedChange={setBulkUseStyledHtml}
              />
            </div>

            {publishing && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Übertrage Artikel...</p>
                <div className="space-y-1">
                  {Array.from(selectedIds).map((id) => {
                    const article = articleMap.get(id);
                    const result = results.get(id);
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        {result ? (
                          result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <span className="truncate">{article?.title || id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPublishOpen(false)} disabled={publishing}>
              Abbrechen
            </Button>
            <Button onClick={handleBulkPublish} disabled={publishing}>
              {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {publishing ? "Übertrage..." : "Übertragen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
