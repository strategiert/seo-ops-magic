import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Loader2, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { NeuronWriterImport } from "@/components/briefs/NeuronWriterImport";
import { GuidelinesDisplay } from "@/components/briefs/GuidelinesDisplay";
import type { NWGuidelines } from "@/lib/api/neuronwriter";

interface ContentBrief {
  id: string;
  project_id: string;
  title: string;
  primary_keyword: string;
  search_intent: string | null;
  target_audience: string | null;
  tonality: string | null;
  target_length: number | null;
  notes: string | null;
  status: string | null;
  priority_score: number | null;
  nw_guidelines: NWGuidelines | null;
  created_at: string;
  updated_at: string;
}

export default function BriefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    primary_keyword: "",
    search_intent: "informational",
    target_audience: "",
    tonality: "",
    target_length: 1500,
    notes: "",
    status: "draft",
  });

  useEffect(() => {
    if (id) {
      loadBrief();
    }
  }, [id]);

  const loadBrief = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_briefs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setBrief(data as unknown as ContentBrief);
      setFormData({
        title: data.title || "",
        primary_keyword: data.primary_keyword || "",
        search_intent: data.search_intent || "informational",
        target_audience: data.target_audience || "",
        tonality: data.tonality || "",
        target_length: data.target_length || 1500,
        notes: data.notes || "",
        status: data.status || "draft",
      });
    } catch (error) {
      console.error("Error loading brief:", error);
      toast({
        title: "Fehler beim Laden",
        description: "Brief konnte nicht geladen werden.",
        variant: "destructive",
      });
      navigate("/briefs");
    } finally {
      setLoading(false);
    }
  };

  const saveBrief = async () => {
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("content_briefs")
        .update({
          title: formData.title,
          primary_keyword: formData.primary_keyword,
          search_intent: formData.search_intent,
          target_audience: formData.target_audience || null,
          tonality: formData.tonality || null,
          target_length: formData.target_length || null,
          notes: formData.notes || null,
          status: formData.status,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Gespeichert",
        description: "Brief wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving brief:", error);
      toast({
        title: "Fehler",
        description: "Brief konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGuidelinesImport = async (guidelines: NWGuidelines) => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from("content_briefs")
        .update({
          nw_guidelines: guidelines as unknown as any,
          status: "in_progress",
        })
        .eq("id", id);

      if (error) throw error;

      setBrief((prev) =>
        prev ? { ...prev, nw_guidelines: guidelines, status: "in_progress" } : null
      );
      setFormData((prev) => ({ ...prev, status: "in_progress" }));
      setImportModalOpen(false);

      toast({
        title: "Guidelines importiert",
        description: `${guidelines.terms?.length || 0} NLP Keywords geladen.`,
      });
    } catch (error) {
      console.error("Error saving guidelines:", error);
      toast({
        title: "Fehler",
        description: "Guidelines konnten nicht gespeichert werden.",
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

  if (!brief) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Brief nicht gefunden</h2>
          <Button className="mt-4" onClick={() => navigate("/briefs")}>
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/briefs")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{formData.title || "Content Brief"}</h1>
              <p className="text-muted-foreground font-mono text-sm">
                {formData.primary_keyword}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              NW Guidelines
            </Button>
            <Button onClick={saveBrief} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        </div>

        <Tabs defaultValue="brief" className="w-full">
          <TabsList>
            <TabsTrigger value="brief">Brief Details</TabsTrigger>
            <TabsTrigger value="guidelines" disabled={!brief.nw_guidelines}>
              SEO Guidelines
              {brief.nw_guidelines && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  NW
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brief" className="space-y-6 mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column - Main Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basis-Informationen</CardTitle>
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
                    <Label htmlFor="keyword">Primary Keyword</Label>
                    <Input
                      id="keyword"
                      value={formData.primary_keyword}
                      onChange={(e) => setFormData({ ...formData, primary_keyword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intent">Search Intent</Label>
                    <Select
                      value={formData.search_intent}
                      onValueChange={(value) => setFormData({ ...formData, search_intent: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informational">Informational</SelectItem>
                        <SelectItem value="transactional">Transaktional</SelectItem>
                        <SelectItem value="navigational">Navigational</SelectItem>
                        <SelectItem value="commercial">Commercial Investigation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Entwurf</SelectItem>
                        <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                        <SelectItem value="completed">Abgeschlossen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Content Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Content-Einstellungen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="audience">Zielgruppe</Label>
                    <Input
                      id="audience"
                      placeholder="z.B. SEO Anfänger, Marketing Manager"
                      value={formData.target_audience}
                      onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tonality">Tonalität</Label>
                    <Input
                      id="tonality"
                      placeholder="z.B. professionell, freundlich, locker"
                      value={formData.tonality}
                      onChange={(e) => setFormData({ ...formData, tonality: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="length">Ziel-Wortanzahl</Label>
                    <Input
                      id="length"
                      type="number"
                      value={formData.target_length}
                      onChange={(e) => setFormData({ ...formData, target_length: parseInt(e.target.value) || 1500 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      placeholder="Zusätzliche Anweisungen..."
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* NeuronWriter CTA if no guidelines */}
            {!brief.nw_guidelines && (
              <Card className="border-dashed border-primary/50 bg-primary/5">
                <CardContent className="flex items-center justify-between py-6">
                  <div className="flex items-center gap-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">NeuronWriter Guidelines importieren</h3>
                      <p className="text-sm text-muted-foreground">
                        Lade NLP-Keywords, Content-Fragen und Konkurrenz-Analyse für optimalen SEO-Content.
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setImportModalOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Importieren
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guidelines" className="mt-4">
            {brief.nw_guidelines && (
              <GuidelinesDisplay guidelines={brief.nw_guidelines} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* NeuronWriter Import Modal */}
      <NeuronWriterImport
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        keyword={formData.primary_keyword}
        onImport={handleGuidelinesImport}
      />
    </AppLayout>
  );
}
