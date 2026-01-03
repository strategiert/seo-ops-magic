import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileJson, Upload, Loader2 } from "lucide-react";

export default function ImportArticle() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get("briefId");

  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!briefId) {
      toast({
        title: "Fehler",
        description: "Brief ID fehlt. Bitte geben Sie die URL mit ?briefId=... Parameter an.",
        variant: "destructive",
      });
      return;
    }

    if (!jsonInput.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte fügen Sie den JSON-Code ein.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      // Parse JSON
      const articleData = JSON.parse(jsonInput);

      // Validate required fields
      if (!articleData.title || !articleData.content_markdown) {
        throw new Error("JSON muss mindestens 'title' und 'content_markdown' enthalten.");
      }

      // Get brief to get project_id and primary_keyword
      const { data: brief, error: briefError } = await supabase
        .from("content_briefs")
        .select("project_id, primary_keyword")
        .eq("id", briefId)
        .single();

      if (briefError) throw briefError;

      // Insert article
      const { data: article, error: articleError } = await supabase
        .from("articles")
        .insert({
          project_id: brief.project_id,
          brief_id: briefId,
          title: articleData.title,
          primary_keyword: brief.primary_keyword,
          content_markdown: articleData.content_markdown,
          meta_title: articleData.meta_title || articleData.title.slice(0, 60),
          meta_description: articleData.meta_description || "",
          outline_json: articleData.outline || [],
          faq_json: articleData.faq || [],
          status: "draft",
          version: 1,
        })
        .select()
        .single();

      if (articleError) throw articleError;

      // Update brief status
      await supabase
        .from("content_briefs")
        .update({ status: "completed" })
        .eq("id", briefId);

      toast({
        title: "Artikel importiert",
        description: `"${article.title}" wurde erfolgreich gespeichert.`,
      });

      navigate(`/articles/${article.id}`);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ungültiges JSON-Format",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileJson className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Artikel importieren</h1>
            <p className="text-muted-foreground">
              Fügen Sie den generierten JSON-Code ein
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>JSON-Code</CardTitle>
            <CardDescription>
              Kopieren Sie den kompletten JSON-Code aus der generierten Datei (z.B. bbc2026.json)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{\n  "title": "...",\n  "meta_title": "...",\n  "meta_description": "...",\n  "content_markdown": "...",\n  "outline": [...],\n  "faq": [...]\n}`}
              className="min-h-[400px] font-mono text-sm"
            />

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={importing || !jsonInput.trim()}
                className="flex-1"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importiere...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Artikel importieren
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={importing}
              >
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>

        {!briefId && (
          <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Hinweis:</strong> Bitte navigieren Sie zu dieser Seite mit dem
                Brief ID Parameter: <code>/import-article?briefId=YOUR_BRIEF_ID</code>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
