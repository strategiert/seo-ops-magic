import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, FileJson, Code, Globe, Wand2 } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { WordPressPublishDialog } from "@/components/articles/WordPressPublishDialog";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const statusOptions = [
  { value: "draft", label: "Entwurf" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Freigegeben" },
  { value: "published", label: "Veröffentlicht" },
];

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    primaryKeyword: "",
    contentMarkdown: "",
    metaTitle: "",
    metaDescription: "",
    status: "draft",
  });

  // Convex queries
  const article = useQuery(
    api.tables.articles.getWithRecipe,
    id ? { id: id as Id<"articles"> } : "skip"
  );

  // Convex mutations
  const updateArticle = useMutation(api.tables.articles.update);

  // Convex actions
  const generateDesignRecipe = useAction(api.actions.gemini.generateDesignRecipe);
  const generateHtmlExport = useAction(api.actions.htmlExport.generate);

  const loading = article === undefined;
  const hasRecipe = !!article?.designRecipe;

  // Sync form data when article loads
  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || "",
        primaryKeyword: article.primaryKeyword || "",
        contentMarkdown: article.contentMarkdown || "",
        metaTitle: article.metaTitle || "",
        metaDescription: article.metaDescription || "",
        status: article.status || "draft",
      });
    }
  }, [article]);

  const saveArticle = async () => {
    if (!id) return;

    setSaving(true);
    try {
      await updateArticle({
        id: id as Id<"articles">,
        title: formData.title,
        primaryKeyword: formData.primaryKeyword || undefined,
        contentMarkdown: formData.contentMarkdown || undefined,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
        status: formData.status,
      });

      toast({
        title: "Gespeichert",
        description: "Artikel wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving article:", error);
      toast({
        title: "Fehler",
        description: "Artikel konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDesignRecipe = async (force = false) => {
    if (!id || !article) return;

    setGeneratingRecipe(true);
    try {
      const result = await generateDesignRecipe({
        articleId: id as Id<"articles">,
        force,
      });

      if (result.success) {
        toast({
          title: result.cached ? "Design Recipe geladen" : "Design Recipe generiert",
          description: `Theme: ${result.theme || "minimal-clean"}`,
        });
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error generating recipe:", error);
      toast({
        title: "Fehler",
        description: "Design Recipe konnte nicht generiert werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingRecipe(false);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!id || !article) return;

    setGeneratingTemplate(true);
    try {
      // For now, just show a message - Elementor templates may need different handling
      toast({
        title: "Elementor Templates",
        description: "Diese Funktion wird bald verfügbar sein.",
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: "Fehler",
        description: "Template konnte nicht generiert werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleGenerateHtmlExport = async () => {
    if (!id || !article) return;

    setGeneratingHtml(true);
    try {
      const result = await generateHtmlExport({
        articleId: id as Id<"articles">,
        format: "full",
      });

      if (result.success && result.exportId) {
        toast({
          title: "HTML Export erstellt",
          description: `Landing Page wurde generiert (${Math.round((result.htmlLength || 0) / 1024)} KB).`,
        });

        // TODO: Download the HTML file from Convex storage or query
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error generating HTML:", error);
      toast({
        title: "Fehler",
        description: "HTML Export konnte nicht generiert werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingHtml(false);
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

  if (article === null) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Artikel nicht gefunden</h2>
          <Button className="mt-4" onClick={() => navigate("/articles")}>
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/articles")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{formData.title || "Artikel"}</h1>
              <p className="text-muted-foreground font-mono text-sm">
                {formData.primaryKeyword || "Kein Keyword"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleGenerateDesignRecipe(false)}
              disabled={generatingRecipe || !formData.contentMarkdown}
              title={hasRecipe ? "Recipe existiert - Klicke erneut zum Aktualisieren" : "Design Recipe generieren"}
            >
              {generatingRecipe ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              {hasRecipe ? "Recipe" : "Design Recipe"}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateHtmlExport}
              disabled={generatingHtml || !formData.contentMarkdown}
            >
              {generatingHtml ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Code className="h-4 w-4 mr-2" />
              )}
              HTML Export
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateTemplate}
              disabled={generatingTemplate || !formData.contentMarkdown}
            >
              {generatingTemplate ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Elementor Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setPublishDialogOpen(true)}
              disabled={!formData.contentMarkdown}
            >
              <Globe className="h-4 w-4 mr-2" />
              WordPress
            </Button>
            <Button onClick={saveArticle} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="meta">Meta & SEO</TabsTrigger>
            <TabsTrigger value="structure">Struktur</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Artikel-Content</CardTitle>
                <Badge variant="outline">v{article?.version || 1}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Markdown Content</Label>
                  <Textarea
                    id="content"
                    value={formData.contentMarkdown}
                    onChange={(e) => setFormData({ ...formData, contentMarkdown: e.target.value })}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Meta-Daten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyword">Primary Keyword</Label>
                  <Input
                    id="keyword"
                    value={formData.primaryKeyword}
                    onChange={(e) => setFormData({ ...formData, primaryKeyword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Meta Title</Label>
                  <Input
                    id="metaTitle"
                    value={formData.metaTitle}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.metaTitle.length}/60 Zeichen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaDesc">Meta Description</Label>
                  <Textarea
                    id="metaDesc"
                    value={formData.metaDescription}
                    onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                    rows={3}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.metaDescription.length}/160 Zeichen
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Outline</CardTitle>
                </CardHeader>
                <CardContent>
                  {article?.outlineJson ? (
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
                      {JSON.stringify(article.outlineJson, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">Kein Outline vorhanden</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>FAQ</CardTitle>
                </CardHeader>
                <CardContent>
                  {article?.faqJson ? (
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
                      {JSON.stringify(article.faqJson, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">Keine FAQs vorhanden</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* WordPress Publish Dialog */}
      {article && (
        <WordPressPublishDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
          articleId={article._id}
          articleTitle={article.title}
          onPublished={() => {
            // Article will auto-refresh via Convex real-time
          }}
        />
      )}
    </AppLayout>
  );
}
