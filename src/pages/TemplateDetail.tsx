import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Copy, Check } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Template {
  id: string;
  project_id: string;
  article_id: string | null;
  name: string;
  design_preset: string | null;
  template_json: any;
  created_at: string;
  updated_at: string;
}

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("elementor_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTemplate(data as Template);
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        title: "Fehler beim Laden",
        description: "Template konnte nicht geladen werden.",
        variant: "destructive",
      });
      navigate("/templates");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    if (!template) return;

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

  const copyToClipboard = async () => {
    if (!template) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(template.template_json, null, 2));
      setCopied(true);
      toast({
        title: "Kopiert",
        description: "JSON in Zwischenablage kopiert.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Konnte nicht kopieren.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!template) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Template nicht gefunden</h2>
          <Button className="mt-4" onClick={() => navigate("/templates")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/templates")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{template.design_preset || "default"}</Badge>
                <span className="text-muted-foreground text-sm">
                  Erstellt am {new Date(template.created_at).toLocaleDateString("de-DE")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyToClipboard}>
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Kopieren
            </Button>
            <Button onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Template Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Design Preset</p>
                <p className="font-medium">{template.design_preset || "default"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Elemente</p>
                <p className="font-medium">
                  {Array.isArray(template.template_json?.content)
                    ? template.template_json.content.length
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Größe</p>
                <p className="font-medium">
                  {(JSON.stringify(template.template_json).length / 1024).toFixed(1)} KB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* JSON Preview */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>JSON Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-[500px] font-mono">
                {JSON.stringify(template.template_json, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
