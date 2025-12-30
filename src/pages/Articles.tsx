import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

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

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject?.id) {
      loadArticles();
    }
  }, [currentProject?.id]);

  const loadArticles = async () => {
    if (!currentProject?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("project_id", currentProject.id)
        .order("updated_at", { ascending: false });

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
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Keine Artikel vorhanden</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Artikel werden aus Content Briefs generiert.
            </p>
            <Button onClick={() => navigate("/briefs")}>
              <Plus className="h-4 w-4 mr-2" />
              Zu den Briefs
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
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
                      {new Date(article.updated_at).toLocaleDateString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
