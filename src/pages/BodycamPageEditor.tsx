import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import {
  Save,
  Upload,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useMemo } from "react";

const LANGS = ["de", "en", "nl", "fr", "es", "it"];
const LANG_LABELS: Record<string, string> = {
  de: "🇩🇪 Deutsch",
  en: "🇬🇧 English",
  nl: "🇳🇱 Nederlands",
  fr: "🇫🇷 Français",
  es: "🇪🇸 Español",
  it: "🇮🇹 Italiano",
};

export default function BodycamPageEditor() {
  const { pageKey } = useParams<{ pageKey: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();

  const [activeLang, setActiveLang] = useState("de");
  const [editMode, setEditMode] = useState<"form" | "json">("form");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const allPages = useQuery(
    api.tables.bodycam.listPages,
    isAuthenticated && pageKey ? { pageKey } : "skip"
  );
  const savePage = useMutation(api.tables.bodycam.savePage);
  const publishPage = useAction(api.actions.bodycam.publishPage);

  // Seiten nach Sprache indexieren
  const pagesByLang = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of allPages ?? []) {
      map[p.lang] = p;
    }
    return map;
  }, [allPages]);

  // Entwurf für aktive Sprache initialisieren
  useEffect(() => {
    const page = pagesByLang[activeLang];
    if (page && drafts[activeLang] === undefined) {
      try {
        const formatted = JSON.stringify(JSON.parse(page.contentJson), null, 2);
        setDrafts((prev) => ({ ...prev, [activeLang]: formatted }));
      } catch {
        setDrafts((prev) => ({ ...prev, [activeLang]: page.contentJson }));
      }
    }
  }, [activeLang, pagesByLang]);

  const currentDraft = drafts[activeLang] ?? "";
  const currentPage = pagesByLang[activeLang];

  const handleDraftChange = (value: string) => {
    setDrafts((prev) => ({ ...prev, [activeLang]: value }));
  };

  const handleSave = async () => {
    if (!pageKey || !currentDraft) return;
    // JSON validieren
    try {
      JSON.parse(currentDraft);
    } catch {
      toast({ title: "Ungültiges JSON", description: "Bitte JSON-Syntax prüfen.", variant: "destructive" });
      return;
    }
    setSaving(activeLang);
    try {
      await savePage({ pageKey, lang: activeLang, contentJson: currentDraft });
      toast({ title: "Gespeichert", description: `${pageKey}/${activeLang} lokal gespeichert.` });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async () => {
    if (!pageKey) return;
    // Erst speichern
    if (currentDraft && (!currentPage || currentPage.contentJson !== currentDraft)) {
      try {
        JSON.parse(currentDraft);
        await savePage({ pageKey, lang: activeLang, contentJson: currentDraft });
      } catch {
        toast({ title: "Ungültiges JSON", description: "Bitte JSON-Syntax prüfen.", variant: "destructive" });
        return;
      }
    }
    setPublishing(activeLang);
    try {
      const result = await publishPage({ pageKey, lang: activeLang });
      if ((result as any).skipped) {
        toast({ title: "Keine Änderungen", description: "Seite ist bereits aktuell." });
      } else {
        toast({
          title: "Publiziert",
          description: `Commit: ${(result as any).commitSha?.slice(0, 7)}. CF Pages rebuild startet.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  };

  // Form-Felder aus JSON extrahieren
  const parsedContent = useMemo(() => {
    try {
      return JSON.parse(currentDraft);
    } catch {
      return null;
    }
  }, [currentDraft]);

  return (
    <AppLayout
      title={pageKey ?? "Seite"}
      breadcrumbs={[
        { label: "Bodycam", href: "/bodycam" },
        { label: "Seiten", href: "/bodycam/pages" },
        { label: pageKey ?? "" },
      ]}
    >
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/bodycam/pages")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <div className="flex-1" />

          {/* Speichern + Publizieren für aktive Sprache */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!!saving}
          >
            {saving === activeLang ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!!publishing}
            className="bg-[#003366] hover:bg-[#002244] text-white"
          >
            {publishing === activeLang ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Publizieren
          </Button>
        </div>

        {/* Sprach-Tabs */}
        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            {LANGS.map((l) => {
              const page = pagesByLang[l];
              return (
                <TabsTrigger key={l} value={l} className="gap-1.5">
                  {LANG_LABELS[l].split(" ")[0]}
                  <span className="hidden sm:inline text-xs">{l.toUpperCase()}</span>
                  {page?.isDirty && (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {LANGS.map((l) => (
            <TabsContent key={l} value={l} className="mt-4">
              {l === activeLang && (
                <EditorPanel
                  pageKey={pageKey!}
                  lang={l}
                  page={pagesByLang[l]}
                  draft={drafts[l] ?? ""}
                  editMode={editMode}
                  onModeChange={setEditMode}
                  onDraftChange={handleDraftChange}
                  parsedContent={parsedContent}
                  onParsedChange={(newContent) =>
                    handleDraftChange(JSON.stringify(newContent, null, 2))
                  }
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── Editor Panel ──────────────────────────────────────────────────────────────

function EditorPanel({
  lang,
  page,
  draft,
  editMode,
  onModeChange,
  onDraftChange,
  parsedContent,
  onParsedChange,
}: {
  pageKey: string;
  lang: string;
  page: any;
  draft: string;
  editMode: "form" | "json";
  onModeChange: (m: "form" | "json") => void;
  onDraftChange: (v: string) => void;
  parsedContent: Record<string, any> | null;
  onParsedChange: (v: Record<string, any>) => void;
}) {
  const isJsonValid = parsedContent !== null;

  return (
    <div className="space-y-3">
      {/* Status + Mode Toggle */}
      <div className="flex items-center gap-3">
        {page ? (
          page.isDirty ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              <AlertCircle className="h-3 w-3 mr-1" />
              Ausstehend
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktuell
            </Badge>
          )
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Nicht importiert
          </Badge>
        )}

        {page?.lastPublishedAt && (
          <span className="text-xs text-muted-foreground">
            Letzter Publish:{" "}
            {new Date(page.lastPublishedAt).toLocaleString("de-DE")}
          </span>
        )}

        <div className="flex-1" />

        <div className="flex gap-1 border rounded-md overflow-hidden text-xs">
          <button
            onClick={() => onModeChange("form")}
            className={`px-3 py-1.5 ${
              editMode === "form" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Formular
          </button>
          <button
            onClick={() => onModeChange("json")}
            className={`px-3 py-1.5 ${
              editMode === "json" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Editor */}
      {!page ? (
        <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
          Diese Sprache ({lang}) wurde noch nicht importiert.
          <br />
          <span className="text-xs">Dashboard → Aus GitHub importieren</span>
        </div>
      ) : editMode === "json" ? (
        <div className="space-y-1">
          <Textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            className={`font-mono text-xs min-h-[60vh] ${!isJsonValid ? "border-red-400" : ""}`}
            spellCheck={false}
          />
          {!isJsonValid && (
            <p className="text-xs text-red-500">Ungültiges JSON — Fehler beim Parsen.</p>
          )}
        </div>
      ) : parsedContent ? (
        <FormEditor
          content={parsedContent}
          onChange={onParsedChange}
        />
      ) : (
        <p className="text-sm text-red-500">JSON ist ungültig. Bitte in JSON-Modus wechseln.</p>
      )}
    </div>
  );
}

// ── Form Editor ───────────────────────────────────────────────────────────────

function FormEditor({
  content,
  onChange,
}: {
  content: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const entries = Object.entries(content);

  const handleFieldChange = (key: string, value: string) => {
    onChange({ ...content, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 gap-3 max-h-[65vh] overflow-y-auto pr-1">
      {entries.map(([key, value]) => {
        if (typeof value === "object") {
          // Objekt / Array → als JSON-Text anzeigen
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">{key}</Label>
              <Textarea
                value={JSON.stringify(value, null, 2)}
                onChange={(e) => {
                  try {
                    handleFieldChange(key, JSON.parse(e.target.value));
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
                className="font-mono text-xs min-h-[80px]"
              />
            </div>
          );
        }

        const isLong =
          typeof value === "string" &&
          (value.length > 100 ||
            key.toLowerCase().includes("text") ||
            key.toLowerCase().includes("desc") ||
            key.toLowerCase().includes("intro") ||
            key.toLowerCase().includes("summary"));

        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">{key}</Label>
            {isLong ? (
              <Textarea
                value={String(value)}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="text-sm min-h-[60px]"
              />
            ) : (
              <Input
                value={String(value)}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="text-sm"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
