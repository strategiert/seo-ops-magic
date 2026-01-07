import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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

interface Template {
  id: string;
  name: string;
  design_preset: string | null;
  article_id: string | null;
  template_json: any;
  created_at: string;
  updated_at: string;
}

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspace();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (currentProject?.id) {
      loadTemplates();
    }
  }, [currentProject?.id, page]);

  const loadTemplates = async () => {
    if (!currentProject?.id) return;

    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get count
      const { count } = await supabase
        .from("elementor_templates")
        .select("*", { count: "exact", head: true })
        .eq("project_id", currentProject.id);

      setTotalCount(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from("elementor_templates")
        .select("*")
        .eq("project_id", currentProject.id)
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast({
        title: "Fehler",
        description: "Templates konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoize formatted dates to avoid creating Date objects on every render
  const formattedDates = useMemo(() => {
    return new Map(
      templates.map((t) => [t.id, new Date(t.created_at).toLocaleDateString("de-DE")])
    );
  }, [templates]);

  const downloadTemplate = (template: Template) => {
    const blob = new Blob([JSON.stringify(template.template_json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download gestartet",
      description: `${template.name}.json`,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Elementor Templates</h1>
            <p className="text-muted-foreground">
              Generierte Templates für WordPress Import
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Keine Templates vorhanden</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Templates werden aus Artikeln generiert.
            </p>
            <Button onClick={() => navigate("/articles")}>
              Zu den Artikeln
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Design Preset</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow
                    key={template.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/templates/${template.id}`)}
                  >
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {template.design_preset || "default"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formattedDates.get(template.id)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadTemplate(template);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Pagination Controls */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  Zeige {page * PAGE_SIZE + 1} bis {Math.min((page + 1) * PAGE_SIZE, totalCount)} von {totalCount} Templates
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
      </div>
    </AppLayout>
  );
}
