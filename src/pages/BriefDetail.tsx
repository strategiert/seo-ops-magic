import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Loader2, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
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
import { NeuronWriterImport } from "@/components/briefs/NeuronWriterImport";
import { GuidelinesDisplay } from "@/components/briefs/GuidelinesDisplay";
import { WorkflowActions } from "@/components/briefs/WorkflowActions";
import type { NWGuidelines } from "@/lib/api/neuronwriter";
import { transformNWGuidelines } from "@/lib/api/neuronwriter";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function BriefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();

  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    primaryKeyword: "",
    searchIntent: "informational",
    targetAudience: "",
    tonality: "",
    targetLength: 1500,
    notes: "",
    status: "draft",
  });

  const isNew = id === "new";

  // Convex queries
  const brief = useQuery(
    api.tables.contentBriefs.get,
    !isNew && id ? { id: id as Id<"contentBriefs"> } : "skip"
  );

  // Query articles to find one linked to this brief
  const articles = useQuery(
    api.tables.articles.listByProject,
    currentProject?._id && !isNew ? { projectId: currentProject._id } : "skip"
  );

  // Find article linked to this brief
  const linkedArticle = articles?.find((a) => a.briefId === id);
  const articleId = linkedArticle?._id ?? null;

  // Convex mutations
  const createBrief = useMutation(api.tables.contentBriefs.create);
  const updateBrief = useMutation(api.tables.contentBriefs.update);

  const loading = !isNew && brief === undefined;

  // Sync form data when brief loads
  useEffect(() => {
    if (brief) {
      // Transform nw_guidelines if they exist (handles old stored data format)
      const transformedGuidelines = brief.nwGuidelines
        ? transformNWGuidelines(brief.nwGuidelines)
        : null;

      setFormData({
        title: brief.title || "",
        primaryKeyword: brief.primaryKeyword || "",
        searchIntent: brief.searchIntent || "informational",
        targetAudience: brief.targetAudience || "",
        tonality: brief.tonality || "",
        targetLength: brief.targetLength || 1500,
        notes: brief.notes || "",
        status: brief.status || "draft",
      });
    }
  }, [brief]);

  const saveBrief = async () => {
    setSaving(true);
    try {
      if (isNew) {
        if (!currentProject?._id) {
          toast({
            title: "Fehler",
            description: "Kein Projekt ausgewählt",
            variant: "destructive",
          });
          return;
        }
        // CREATE
        const newBriefId = await createBrief({
          projectId: currentProject._id,
          title: formData.title,
          primaryKeyword: formData.primaryKeyword,
          searchIntent: formData.searchIntent,
          targetAudience: formData.targetAudience || undefined,
          tonality: formData.tonality || undefined,
          targetLength: formData.targetLength || undefined,
          notes: formData.notes || undefined,
          status: formData.status,
        });

        toast({ title: "Erstellt", description: "Brief wurde angelegt." });
        navigate(`/briefs/${newBriefId}`);
      } else {
        // UPDATE
        await updateBrief({
          id: id as Id<"contentBriefs">,
          title: formData.title,
          primaryKeyword: formData.primaryKeyword,
          searchIntent: formData.searchIntent,
          targetAudience: formData.targetAudience || undefined,
          tonality: formData.tonality || undefined,
          targetLength: formData.targetLength || undefined,
          notes: formData.notes || undefined,
          status: formData.status,
        });

        toast({
          title: "Gespeichert",
          description: "Brief wurde aktualisiert.",
        });
      }
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
    if (!id || isNew) return;

    try {
      await updateBrief({
        id: id as Id<"contentBriefs">,
        nwGuidelines: guidelines as unknown as any,
        status: "in_progress",
      });

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

  if (!isNew && brief === null) {
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

  const nwGuidelines = brief?.nwGuidelines
    ? transformNWGuidelines(brief.nwGuidelines)
    : null;

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
              <h1 className="text-2xl font-bold">
                {formData.title || "Content Brief"}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">
                {formData.primaryKeyword}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant={nwGuidelines ? "default" : "outline"}
                onClick={() => setImportModalOpen(true)}
              >
                <Download className="h-4 w-4 mr-2" />
                {nwGuidelines ? "Regenerieren" : "NW Guidelines"}
              </Button>
            )}
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
            <TabsTrigger value="guidelines" disabled={!nwGuidelines}>
              SEO Guidelines
              {nwGuidelines && (
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
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyword">Primary Keyword</Label>
                    <Input
                      id="keyword"
                      value={formData.primaryKeyword}
                      onChange={(e) =>
                        setFormData({ ...formData, primaryKeyword: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intent">Search Intent</Label>
                    <Select
                      value={formData.searchIntent}
                      onValueChange={(value) =>
                        setFormData({ ...formData, searchIntent: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informational">Informational</SelectItem>
                        <SelectItem value="transactional">Transaktional</SelectItem>
                        <SelectItem value="navigational">Navigational</SelectItem>
                        <SelectItem value="commercial">
                          Commercial Investigation
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending" disabled>
                          Ausstehend
                        </SelectItem>
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
                      value={formData.targetAudience}
                      onChange={(e) =>
                        setFormData({ ...formData, targetAudience: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tonality">Tonalität</Label>
                    <Input
                      id="tonality"
                      placeholder="z.B. professionell, freundlich, locker"
                      value={formData.tonality}
                      onChange={(e) =>
                        setFormData({ ...formData, tonality: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="length">Ziel-Wortanzahl</Label>
                    <Input
                      id="length"
                      type="number"
                      value={formData.targetLength}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          targetLength: parseInt(e.target.value) || 1500,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      placeholder="Zusätzliche Anweisungen..."
                      rows={4}
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* NeuronWriter CTA if no guidelines */}
            {!isNew && !nwGuidelines && (
              <Card className="border-dashed border-primary/50 bg-primary/5">
                <CardContent className="flex items-center justify-between py-6">
                  <div className="flex items-center gap-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">
                        NeuronWriter Guidelines importieren
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Lade NLP-Keywords, Content-Fragen und Konkurrenz-Analyse
                        für optimalen SEO-Content.
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

            {/* Workflow Actions */}
            {!isNew && (
              <WorkflowActions
                briefId={id!}
                hasGuidelines={!!nwGuidelines}
                articleId={articleId}
                templateId={null}
                onOpenImport={() => setImportModalOpen(true)}
                onArticleGenerated={() => {}}
              />
            )}
          </TabsContent>

          <TabsContent value="guidelines" className="mt-4">
            {nwGuidelines && <GuidelinesDisplay guidelines={nwGuidelines} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* NeuronWriter Import Modal */}
      {!isNew && (
        <NeuronWriterImport
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          keyword={formData.primaryKeyword}
          onImport={handleGuidelinesImport}
        />
      )}
    </AppLayout>
  );
}
