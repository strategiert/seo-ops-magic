import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, Download } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { DataStateWrapper, EmptyState, TableSkeleton } from "@/components/data-state";
import { api } from "../../convex/_generated/api";

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();

  // Use Convex query for real-time templates data
  const templatesData = useQuery(
    api.tables.elementorTemplates.listByProject,
    currentProject?._id ? { projectId: currentProject._id } : "skip"
  );

  const loading = templatesData === undefined;
  const templates = templatesData ?? [];

  // Memoize formatted dates to avoid creating Date objects on every render
  const formattedDates = useMemo(() => {
    return new Map(
      templates.map((t) => [t._id, new Date(t._creationTime).toLocaleDateString("de-DE")])
    );
  }, [templates]);

  const downloadTemplate = (template: (typeof templates)[0]) => {
    const blob = new Blob([JSON.stringify(template.templateJson, null, 2)], {
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

        <DataStateWrapper
          isLoading={loading}
          data={templates}
          skeleton={<TableSkeleton rows={5} />}
          emptyState={
            <EmptyState
              icon={FileJson}
              title="Keine Templates vorhanden"
              description="Templates werden aus Artikeln generiert."
              action={{
                label: "Zu den Artikeln",
                onClick: () => navigate("/articles"),
              }}
            />
          }
        >
          {(templates) => (
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
                      key={template._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/templates/${template._id}`)}
                    >
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {template.designPreset || "default"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formattedDates.get(template._id)}
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
            </div>
          )}
        </DataStateWrapper>
      </div>
    </AppLayout>
  );
}
