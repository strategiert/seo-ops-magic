import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  Globe,
  Sparkles,
  RefreshCw,
  Package,
  Users,
  Tag,
  Swords,
  Palette,
  Link2,
  MessageSquare,
  Database,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBrandProfile, type Product, type Service, type Persona, type Competitor } from "@/hooks/useBrandProfile";

export function BrandIntelligenceSetup() {
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  const {
    brandProfile,
    loading,
    error,
    crawlStatus,
    triggerCrawl,
    triggerAnalysis,
    updateProfile,
    syncVectorStore,
    resetProfile,
    refreshProfile,
  } = useBrandProfile();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showCrawlForm, setShowCrawlForm] = useState(false);

  // Collapsible states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    voice: true,
    products: false,
    personas: false,
    keywords: false,
    competitors: false,
    visual: false,
    links: false,
  });

  // Edit states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartCrawl = async () => {
    const url = websiteUrl || currentProject?.wp_url || `https://${currentProject?.domain}`;
    if (!url) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Website-URL ein.",
        variant: "destructive",
      });
      return;
    }

    setCrawling(true);
    const result = await triggerCrawl(url, 20);
    setCrawling(false);

    if (result.success) {
      toast({
        title: "Crawling gestartet",
        description: "Die Website wird analysiert. Das kann einige Minuten dauern.",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Crawling konnte nicht gestartet werden.",
        variant: "destructive",
      });
    }
  };

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    const result = await triggerAnalysis();
    setAnalyzing(false);

    if (result.success) {
      toast({
        title: "Analyse abgeschlossen",
        description: "Das Brand-Profil wurde erstellt.",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Analyse fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const handleSyncVectorStore = async () => {
    setSyncing(true);
    const result = await syncVectorStore();
    setSyncing(false);

    if (result.success) {
      toast({
        title: "Vector Store synchronisiert",
        description: "Die Brand-Daten sind jetzt in der KI-Memory verfügbar.",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Synchronisation fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    if (!confirm("Bist du sicher? Alle Brand-Daten werden gelöscht und der Crawl-Status zurückgesetzt.")) {
      return;
    }

    setResetting(true);
    const result = await resetProfile();
    setResetting(false);
    setShowCrawlForm(false);

    if (result.success) {
      toast({
        title: "Zurückgesetzt",
        description: "Das Brand-Profil wurde zurückgesetzt.",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Reset fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const handleSaveField = async (field: string, value: unknown) => {
    setSaving(true);
    const result = await updateProfile({ [field]: value });
    setSaving(false);
    setEditingField(null);

    if (result.success) {
      toast({
        title: "Gespeichert",
        description: "Änderung wurde gespeichert.",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const renderEditableText = (
    field: string,
    label: string,
    value: string | null,
    multiline = false
  ) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editingField === field ? (
        <div className="flex gap-2">
          {multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[80px]"
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
          )}
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={() => handleSaveField(field, editValue)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}>
              X
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="p-2 bg-muted/30 rounded cursor-pointer hover:bg-muted/50 min-h-[36px]"
          onClick={() => startEditing(field, value || "")}
        >
          {value || <span className="text-muted-foreground italic">Klicken zum Bearbeiten</span>}
        </div>
      )}
    </div>
  );

  const renderStatusBadge = () => {
    switch (crawlStatus) {
      case "pending":
        return <Badge variant="outline">Noch nicht analysiert</Badge>;
      case "crawling":
        return (
          <Badge className="bg-blue-500/20 text-blue-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Crawling...
          </Badge>
        );
      case "analyzing":
        return (
          <Badge className="bg-purple-500/20 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
            Analysiere...
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500/20 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Abgeschlossen
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Fehler
          </Badge>
        );
      default:
        return null;
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">Brand Intelligence</CardTitle>
          <CardDescription>
            Bitte wähle zuerst ein Projekt aus.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isBusy = crawlStatus === "crawling" || crawlStatus === "analyzing";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Brand Intelligence
              {renderStatusBadge()}
            </CardTitle>
            <CardDescription>
              KI-gestützte Analyse der Markenidentität für konsistente Inhalte
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={refreshProfile} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Crawl Controls */}
        {!brandProfile || crawlStatus === "pending" || crawlStatus === "error" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Website-URL</Label>
              <Input
                placeholder={currentProject?.wp_url || `https://${currentProject?.domain || "beispiel.de"}`}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen um die Projekt-Domain zu verwenden
              </p>
            </div>

            {crawlStatus === "error" && brandProfile?.crawl_error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{brandProfile.crawl_error}</p>
              </div>
            )}

            <Button onClick={handleStartCrawl} disabled={crawling || isBusy}>
              {crawling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Globe className="h-4 w-4 mr-2" />
              Website analysieren
            </Button>
          </div>
        ) : isBusy ? (
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">
                  {crawlStatus === "crawling" ? "Website wird gecrawlt..." : "Daten werden analysiert..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Das kann einige Minuten dauern.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Brand Profile Display */
          <div className="space-y-4">
            {/* Crawl Form (toggleable) */}
            {showCrawlForm && (
              <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <div className="space-y-2">
                  <Label>Website-URL</Label>
                  <Input
                    placeholder={currentProject?.wp_url || `https://${currentProject?.domain || "beispiel.de"}`}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leer lassen um die Projekt-Domain zu verwenden
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleStartCrawl} disabled={crawling}>
                    {crawling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Globe className="h-4 w-4 mr-2" />
                    Crawlen starten
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCrawlForm(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowCrawlForm(!showCrawlForm)} disabled={crawling}>
                {crawling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <RefreshCw className="h-4 w-4 mr-2" />
                Neu crawlen
              </Button>
              <Button variant="outline" size="sm" onClick={handleStartAnalysis} disabled={analyzing}>
                {analyzing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Sparkles className="h-4 w-4 mr-2" />
                Neu analysieren
              </Button>
              <Button variant="outline" size="sm" onClick={handleSyncVectorStore} disabled={syncing}>
                {syncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Database className="h-4 w-4 mr-2" />
                Vector Store sync
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting} className="text-destructive hover:text-destructive">
                {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <RotateCcw className="h-4 w-4 mr-2" />
                Zurücksetzen
              </Button>
            </div>

            {/* Core Brand Identity */}
            <div className="grid gap-4">
              {renderEditableText("brand_name", "Markenname", brandProfile?.brand_name)}
              {renderEditableText("tagline", "Tagline / Claim", brandProfile?.tagline)}
              {renderEditableText("mission_statement", "Mission Statement", brandProfile?.mission_statement, true)}
              {renderEditableText("brand_story", "Brand Story", brandProfile?.brand_story, true)}
            </div>

            {/* Brand Voice Section */}
            <Collapsible open={openSections.voice} onOpenChange={() => toggleSection("voice")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Brand Voice</span>
                  </div>
                  {openSections.voice ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Ton</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandProfile?.brand_voice?.tone?.map((t, i) => (
                      <Badge key={i} variant="secondary">{t}</Badge>
                    )) || <span className="text-sm text-muted-foreground">Keine</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Persönlichkeitsmerkmale</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandProfile?.brand_voice?.personality_traits?.map((t, i) => (
                      <Badge key={i} variant="secondary">{t}</Badge>
                    )) || <span className="text-sm text-muted-foreground">Keine</span>}
                  </div>
                </div>
                {brandProfile?.brand_voice?.writing_style && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Formalität:</span>{" "}
                      {brandProfile.brand_voice.writing_style.formality || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Satzlänge:</span>{" "}
                      {brandProfile.brand_voice.writing_style.sentence_length || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vokabular:</span>{" "}
                      {brandProfile.brand_voice.writing_style.vocabulary_level || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Jargon:</span>{" "}
                      {brandProfile.brand_voice.writing_style.use_of_jargon || "-"}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Products & Services Section */}
            <Collapsible open={openSections.products} onOpenChange={() => toggleSection("products")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>
                      Produkte & Dienstleistungen
                      <Badge variant="outline" className="ml-2">
                        {(brandProfile?.products?.length || 0) + (brandProfile?.services?.length || 0)}
                      </Badge>
                    </span>
                  </div>
                  {openSections.products ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                {brandProfile?.products?.map((product: Product, i: number) => (
                  <div key={i} className="p-2 bg-muted/30 rounded">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                    {product.price && <p className="text-sm font-mono">{product.price}</p>}
                    {product.features?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.features.map((f, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {brandProfile?.services?.map((service: Service, i: number) => (
                  <div key={`s-${i}`} className="p-2 bg-muted/30 rounded border-l-2 border-primary">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    {service.pricing_model && (
                      <Badge variant="secondary" className="mt-1">{service.pricing_model}</Badge>
                    )}
                  </div>
                ))}
                {!brandProfile?.products?.length && !brandProfile?.services?.length && (
                  <p className="text-sm text-muted-foreground">Keine Produkte oder Services gefunden</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Personas Section */}
            <Collapsible open={openSections.personas} onOpenChange={() => toggleSection("personas")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      Zielgruppen / Personas
                      <Badge variant="outline" className="ml-2">{brandProfile?.personas?.length || 0}</Badge>
                    </span>
                  </div>
                  {openSections.personas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                {brandProfile?.personas?.map((persona: Persona, i: number) => (
                  <div key={i} className="p-2 bg-muted/30 rounded">
                    <p className="font-medium">{persona.name}</p>
                    <p className="text-sm text-muted-foreground">{persona.demographics}</p>
                    {persona.pain_points?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Pain Points:</span>
                        <ul className="text-sm list-disc list-inside">
                          {persona.pain_points.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {persona.goals?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Ziele:</span>
                        <ul className="text-sm list-disc list-inside">
                          {persona.goals.map((g, j) => <li key={j}>{g}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {!brandProfile?.personas?.length && (
                  <p className="text-sm text-muted-foreground">Keine Personas gefunden</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Keywords Section */}
            <Collapsible open={openSections.keywords} onOpenChange={() => toggleSection("keywords")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span>Brand Keywords</span>
                  </div>
                  {openSections.keywords ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Primary Keywords</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandProfile?.brand_keywords?.primary?.map((k, i) => (
                      <Badge key={i} className="bg-primary/20">{k}</Badge>
                    )) || <span className="text-sm text-muted-foreground">Keine</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Secondary Keywords</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandProfile?.brand_keywords?.secondary?.map((k, i) => (
                      <Badge key={i} variant="secondary">{k}</Badge>
                    )) || <span className="text-sm text-muted-foreground">Keine</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Long-Tail Keywords</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandProfile?.brand_keywords?.long_tail?.map((k, i) => (
                      <Badge key={i} variant="outline">{k}</Badge>
                    )) || <span className="text-sm text-muted-foreground">Keine</span>}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Competitors Section */}
            <Collapsible open={openSections.competitors} onOpenChange={() => toggleSection("competitors")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4" />
                    <span>
                      Wettbewerber
                      <Badge variant="outline" className="ml-2">{brandProfile?.competitors?.length || 0}</Badge>
                    </span>
                  </div>
                  {openSections.competitors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                {brandProfile?.competitors?.map((comp: Competitor, i: number) => (
                  <div key={i} className="p-2 bg-muted/30 rounded">
                    <p className="font-medium">{comp.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{comp.domain}</p>
                    {comp.strengths?.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-green-600">Stärken: </span>
                        <span className="text-sm">{comp.strengths.join(", ")}</span>
                      </div>
                    )}
                    {comp.weaknesses?.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-red-600">Schwächen: </span>
                        <span className="text-sm">{comp.weaknesses.join(", ")}</span>
                      </div>
                    )}
                  </div>
                ))}
                {!brandProfile?.competitors?.length && (
                  <p className="text-sm text-muted-foreground">Keine Wettbewerber gefunden</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Visual Identity Section */}
            <Collapsible open={openSections.visual} onOpenChange={() => toggleSection("visual")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    <span>Visual Identity</span>
                  </div>
                  {openSections.visual ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                {brandProfile?.visual_identity?.primary_color && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: brandProfile.visual_identity.primary_color }}
                    />
                    <span className="text-sm">{brandProfile.visual_identity.primary_color}</span>
                  </div>
                )}
                {brandProfile?.visual_identity?.secondary_colors?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {brandProfile.visual_identity.secondary_colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs">{color}</span>
                      </div>
                    ))}
                  </div>
                )}
                {brandProfile?.visual_identity?.imagery_style && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Bildstil:</span>{" "}
                    {brandProfile.visual_identity.imagery_style}
                  </p>
                )}
                {!brandProfile?.visual_identity?.primary_color && (
                  <p className="text-sm text-muted-foreground">Keine Visual Identity erkannt</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Internal Links Section */}
            <Collapsible open={openSections.links} onOpenChange={() => toggleSection("links")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    <span>
                      Interne Links
                      <Badge variant="outline" className="ml-2">{brandProfile?.internal_links?.length || 0}</Badge>
                    </span>
                  </div>
                  {openSections.links ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {brandProfile?.internal_links?.map((link, i) => (
                    <div key={i} className="text-sm p-1 hover:bg-muted/30 rounded">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {link.title || link.url}
                      </a>
                      {link.page_type && (
                        <Badge variant="outline" className="ml-2 text-xs">{link.page_type}</Badge>
                      )}
                    </div>
                  ))}
                  {!brandProfile?.internal_links?.length && (
                    <p className="text-sm text-muted-foreground">Keine internen Links gefunden</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Vector Store Status */}
            {brandProfile?.openai_vector_store_id && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Vector Store aktiv: {brandProfile.openai_vector_store_id}
                </p>
              </div>
            )}

            {/* Last Analysis Info */}
            {brandProfile?.last_analysis_at && (
              <p className="text-xs text-muted-foreground text-right">
                Letzte Analyse: {new Date(brandProfile.last_analysis_at).toLocaleString("de-DE")}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
