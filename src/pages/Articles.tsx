import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, PenTool, Loader2, Globe, CheckCircle2, XCircle, Palette } from "lucide-react";
import { useQuery } from "convex/react";
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
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { useWordPressBulkPublish } from "@/hooks/useWordPress";
import { CreateArticleDialog } from "@/components/articles/CreateArticleDialog";
import { api } from "../../convex/_generated/api";

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
  const { currentProject } = useWorkspaceConvex();
  const { publishing, results, publishMultiple } = useWordPressBulkPublish();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"publish" | "draft">("draft");
  const [bulkUseStyledHtml, setBulkUseStyledHtml] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Use Convex query for real-time articles data
  const articlesData = useQuery(
    api.tables.articles.listByProject,
    currentProject?._id ? { projectId: currentProject._id } : "skip"
  );

  const loading = articlesData === undefined;
  const articles = articlesData ?? [];

  // Sort by creation time descending
  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => b._creationTime - a._creationTime);
  }, [articles]);

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
    if (selectedIds.size === sortedArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedArticles.map((a) => a._id)));
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
    } else {
      toast({
        title: "Teilweise fehlgeschlagen",
        description: `${successCount} erfolgreich, ${failCount} fehlgeschlagen.`,
        variant: "destructive",
      });
    }
  };

  // Memoize article map for O(1) lookup in bulk publish dialog
  const articleMap = useMemo(() => {
    return new Map(sortedArticles.map((a) => [a._id, a]));
  }, [sortedArticles]);

  // Memoize formatted dates to avoid creating Date objects on every render
  const formattedDates = useMemo(() => {
    return new Map(
      sortedArticles.map((a) => [a._id, new Date(a._creationTime).toLocaleDateString("de-DE")])
    );
  }, [sortedArticles]);

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
          data={sortedArticles}
          skeleton={<TableSkeleton rows={5} />}
          emptyState={
            <EmptyState
              icon={FileText}
              title="Keine Artikel vorhanden"
              description="Erstelle einen Content Brief für SEO-optimierte Artikel oder schreibe direkt."
            >
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button onClick={() => navigate("/briefs")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Content Brief erstellen
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <PenTool className="h-4 w-4 mr-2" />
                  Artikel ohne Brief
                </Button>
              </div>
            </EmptyState>
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
                    <TableHead className="text-right">Erstellt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow
                      key={article._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/articles/${article._id}`)}
                    >
                      <TableCell onClick={(e) => toggleSelect(article._id, e)}>
                        <Checkbox checked={selectedIds.has(article._id)} />
                      </TableCell>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {article.primaryKeyword || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[article.status || "draft"]}>
                          {statusLabels[article.status || "draft"]}
                        </Badge>
                      </TableCell>
                      <TableCell>v{article.version || 1}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formattedDates.get(article._id)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      {/* Create Article Dialog */}
      <CreateArticleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(articleId) => navigate(`/articles/${articleId}`)}
      />
    </AppLayout>
  );
}
