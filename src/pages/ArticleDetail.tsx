import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, FileJson, Code, Download } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  project_id: string;
  brief_id: string | null;
  title: string;
  primary_keyword: string | null;
  content_markdown: string | null;
  content_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  outline_json: any;
  faq_json: any;
  status: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
}

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

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    primary_keyword: "",
    content_markdown: "",
    meta_title: "",
    meta_description: "",
    status: "draft",
  });

  useEffect(() => {
    if (id) {
      loadArticle();
    }
  }, [id]);

  const loadArticle = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setArticle(data as Article);
      setFormData({
        title: data.title || "",
        primary_keyword: data.primary_keyword || "",
        content_markdown: data.content_markdown || "",
        meta_title: data.meta_title || "",
        meta_description: data.meta_description || "",
        status: data.status || "draft",
      });
    } catch (error) {
      console.error("Error loading article:", error);
      toast({
        title: "Fehler beim Laden",
        description: "Artikel konnte nicht geladen werden.",
        variant: "destructive",
      });
      navigate("/articles");
    } finally {
      setLoading(false);
    }
  };

  const saveArticle = async () => {
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("articles")
        .update({
          title: formData.title,
          primary_keyword: formData.primary_keyword || null,
          content_markdown: formData.content_markdown || null,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          status: formData.status,
        })
        .eq("id", id);

      if (error) throw error;

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

  const generateTemplate = async () => {
    if (!id || !article) return;

    setGeneratingTemplate(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-elementor-template", {
        body: { articleId: id },
      });

      if (error) throw error;

      toast({
        title: "Template generiert",
        description: "Elementor Template wurde erstellt.",
      });

      navigate(`/templates/${data.templateId}`);
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

  const generateHtmlExport = async () => {
    if (!id || !article) return;

    setGeneratingHtml(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-html-export", {
        body: { articleId: id },
      });

      if (error) throw error;

      toast({
        title: "HTML Export erstellt",
        description: `Landing Page wurde generiert (${Math.round((data.htmlLength || 0) / 1024)} KB).`,
      });

      // Fetch and download the HTML
      const { data: exportData } = await supabase
        .from("html_exports")
        .select("html_content, name")
        .eq("id", data.exportId)
        .single();

      if (exportData?.html_content) {
        const blob = new Blob([exportData.html_content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${article.primary_keyword || article.title}.html`.replace(/[^a-z0-9äöü\-]/gi, "_");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

  if (!article) {
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
                {formData.primary_keyword || "Kein Keyword"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={generateHtmlExport}
              disabled={generatingHtml || !formData.content_markdown}
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
              onClick={generateTemplate}
              disabled={generatingTemplate || !formData.content_markdown}
            >
              {generatingTemplate ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Elementor Template
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
                <Badge variant="outline">v{article.version || 1}</Badge>
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
                    value={formData.content_markdown}
                    onChange={(e) => setFormData({ ...formData, content_markdown: e.target.value })}
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
                    value={formData.primary_keyword}
                    onChange={(e) => setFormData({ ...formData, primary_keyword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Meta Title</Label>
                  <Input
                    id="metaTitle"
                    value={formData.meta_title}
                    onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.meta_title.length}/60 Zeichen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaDesc">Meta Description</Label>
                  <Textarea
                    id="metaDesc"
                    value={formData.meta_description}
                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                    rows={3}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.meta_description.length}/160 Zeichen
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
                  {article.outline_json ? (
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
                      {JSON.stringify(article.outline_json, null, 2)}
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
                  {article.faq_json ? (
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
                      {JSON.stringify(article.faq_json, null, 2)}
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
    </AppLayout>
  );
}
