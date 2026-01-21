import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileJson, Upload, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function ImportArticle() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get("briefId");

  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);

  // Convex queries and mutations
  const brief = useQuery(
    api.tables.contentBriefs.get,
    briefId ? { id: briefId as Id<"contentBriefs"> } : "skip"
  );

  const createArticle = useMutation(api.tables.articles.create);
  const updateBrief = useMutation(api.tables.contentBriefs.update);

  const handleImport = async () => {
    if (!briefId || !brief) {
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

      // Insert article
      const articleId = await createArticle({
        projectId: brief.projectId,
        briefId: briefId as Id<"contentBriefs">,
        title: articleData.title,
        primaryKeyword: brief.primaryKeyword,
        contentMarkdown: articleData.content_markdown,
        metaTitle: articleData.meta_title || articleData.title.slice(0, 60),
        metaDescription: articleData.meta_description || "",
        outlineJson: articleData.outline || [],
        faqJson: articleData.faq || [],
        status: "draft",
      });

      // Update brief status
      await updateBrief({
        id: briefId as Id<"contentBriefs">,
        status: "completed",
      });

      toast({
        title: "Artikel importiert",
        description: `"${articleData.title}" wurde erfolgreich gespeichert.`,
      });

      navigate(`/articles/${articleId}`);
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
                disabled={importing || !jsonInput.trim() || !brief}
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
