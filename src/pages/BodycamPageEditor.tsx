import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import {
  Save,
  Upload,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { groupContentBySection } from "@/lib/sectionGroups";
import { VisualPreview } from "@/components/bodycam/editor/VisualPreview";
import { PropertiesPanel } from "@/components/bodycam/editor/PropertiesPanel";
import { AIChatPanel } from "@/components/bodycam/editor/AIChatPanel";

const LANGS = ["de", "en", "nl", "fr", "es", "it"];
const LANG_LABELS: Record<string, string> = {
  de: "🇩🇪 DE",
  en: "🇬🇧 EN",
  nl: "🇳🇱 NL",
  fr: "🇫🇷 FR",
  es: "🇪🇸 ES",
  it: "🇮🇹 IT",
};

type EditorMode = "visual" | "json";

export default function BodycamPageEditor() {
  const { pageKey } = useParams<{ pageKey: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();

  const [activeLang, setActiveLang] = useState("de");
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Drafts: pro Sprache ein Record<key, value>
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  // JSON-Modus: raw string per Sprache
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Draft für aktive Sprache aus DB initialisieren
  useEffect(() => {
    const page = pagesByLang[activeLang];
    if (page && !drafts[activeLang]) {
      try {
        const parsed = JSON.parse(page.contentJson);
        const record: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          record[k] = String(v ?? "");
        }
        setDrafts((prev) => ({ ...prev, [activeLang]: record }));
        setJsonDrafts((prev) => ({
          ...prev,
          [activeLang]: JSON.stringify(parsed, null, 2),
        }));
      } catch {
        setDrafts((prev) => ({ ...prev, [activeLang]: {} }));
        setJsonDrafts((prev) => ({ ...prev, [activeLang]: page.contentJson }));
      }
    }
  }, [activeLang, pagesByLang]);

  const currentDraft = drafts[activeLang] ?? null;
  const currentJsonDraft = jsonDrafts[activeLang] ?? "";
  const currentPage = pagesByLang[activeLang];

  // Sections für aktuelle Sprache
  const sections = useMemo(() => {
    if (!currentDraft) return [];
    return groupContentBySection(currentDraft);
  }, [currentDraft]);

  const selectedSectionData = useMemo(() => {
    if (!selectedSection) return null;
    return sections.find((s) => s.id === selectedSection) ?? null;
  }, [sections, selectedSection]);

  // Field-Update (Properties Panel)
  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setDrafts((prev) => ({
        ...prev,
        [activeLang]: { ...(prev[activeLang] ?? {}), [key]: value },
      }));
      setJsonDrafts((prev) => {
        const current = { ...(drafts[activeLang] ?? {}), [key]: value };
        return { ...prev, [activeLang]: JSON.stringify(current, null, 2) };
      });
      // Debounced Auto-Save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        doAutoSave(activeLang, { ...(drafts[activeLang] ?? {}), [key]: value });
      }, 800);
    },
    [activeLang, drafts]
  );

  // AI Updates anwenden
  const handleApplyAIUpdates = useCallback(
    (updates: Record<string, string>) => {
      setDrafts((prev) => {
        const current = { ...(prev[activeLang] ?? {}) };
        for (const [k, v] of Object.entries(updates)) {
          current[k] = v;
        }
        setJsonDrafts((jprev) => ({
          ...jprev,
          [activeLang]: JSON.stringify(current, null, 2),
        }));
        doAutoSave(activeLang, current);
        return { ...prev, [activeLang]: current };
      });
      toast({
        title: "KI-Änderungen angewendet",
        description: `${Object.keys(updates).length} Felder aktualisiert.`,
      });
    },
    [activeLang]
  );

  // JSON-Modus change
  const handleJsonChange = (value: string) => {
    setJsonDrafts((prev) => ({ ...prev, [activeLang]: value }));
    try {
      const parsed = JSON.parse(value);
      const record: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        record[k] = String(v ?? "");
      }
      setDrafts((prev) => ({ ...prev, [activeLang]: record }));
    } catch {
      // Ungültiges JSON → kein Update der drafts
    }
  };

  const doAutoSave = async (lang: string, content: Record<string, string>) => {
    if (!pageKey) return;
    setSaving(true);
    try {
      await savePage({ pageKey, lang, contentJson: JSON.stringify(content) });
    } catch {
      // Silent fail bei Auto-Save
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!pageKey || !currentDraft) return;
    setSaving(true);
    try {
      await savePage({
        pageKey,
        lang: activeLang,
        contentJson: JSON.stringify(currentDraft),
      });
      toast({ title: "Gespeichert", description: `${pageKey} (${activeLang}) gespeichert.` });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!pageKey) return;
    if (currentDraft) {
      await savePage({
        pageKey,
        lang: activeLang,
        contentJson: JSON.stringify(currentDraft),
      });
    }
    setPublishing(true);
    try {
      const result = await publishPage({ pageKey, lang: activeLang });
      if ((result as any).skipped) {
        toast({ title: "Keine Änderungen", description: "Seite ist bereits aktuell." });
      } else {
        toast({
          title: "Publiziert",
          description: `Commit: ${(result as any).commitSha?.slice(0, 7)}. CF Pages Rebuild läuft.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white shrink-0 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bodycam/pages")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Zurück
        </Button>

        <div className="flex items-center gap-1.5 ml-1">
          <span className="font-semibold text-sm text-[#003366]">{pageKey}</span>
          {currentPage?.isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Ausstehend
            </Badge>
          )}
          {currentPage && !currentPage.isDirty && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktuell
            </Badge>
          )}
        </div>

        {/* Sprach-Tabs */}
        <div className="flex gap-0.5 ml-3">
          {LANGS.map((l) => {
            const page = pagesByLang[l];
            return (
              <button
                key={l}
                onClick={() => {
                  setActiveLang(l);
                  setSelectedSection(null);
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors relative ${
                  activeLang === l
                    ? "bg-[#003366] text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {LANG_LABELS[l]}
                {page?.isDirty && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ff6600]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Mode Toggle */}
        <div className="flex items-center border rounded-md overflow-hidden text-xs">
          <button
            onClick={() => setEditorMode("visual")}
            className={`px-3 py-1.5 transition-colors ${
              editorMode === "visual"
                ? "bg-[#003366] text-white"
                : "hover:bg-muted"
            }`}
          >
            Visual
          </button>
          <button
            onClick={() => setEditorMode("json")}
            className={`px-2.5 py-1.5 flex items-center gap-1 transition-colors ${
              editorMode === "json"
                ? "bg-[#003366] text-white"
                : "hover:bg-muted"
            }`}
          >
            <Code2 className="h-3 w-3" />
            JSON
          </button>
        </div>

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-8 text-xs"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Speichern
        </Button>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={publishing}
          className="h-8 text-xs bg-[#003366] hover:bg-[#002244] text-white"
        >
          {publishing ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          Publizieren
        </Button>

        {/* Preview-Link */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() =>
            window.open(`/bodycam/preview/${pageKey}/${activeLang}`, "_blank")
          }
          title="Vorschau in neuem Tab öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Main Area ────────────────────────────────────────────────────── */}
      {editorMode === "json" ? (
        <JsonEditor
          value={currentJsonDraft}
          onChange={handleJsonChange}
          onSave={handleSave}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* AI Chat (links) */}
          <div className="w-64 border-r shrink-0 overflow-hidden">
            <AIChatPanel
              pageKey={pageKey ?? ""}
              lang={activeLang}
              currentContent={currentDraft}
              onApplyUpdates={handleApplyAIUpdates}
            />
          </div>

          {/* Visual Preview (mitte) */}
          <div className="flex-1 overflow-hidden border-r">
            <VisualPreview
              content={currentDraft}
              selectedSection={selectedSection}
              onSelectSection={setSelectedSection}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>

          {/* Properties Panel (rechts) */}
          <div className="w-72 shrink-0 overflow-hidden">
            <PropertiesPanel
              section={
                selectedSectionData
                  ? {
                      ...selectedSectionData,
                      // Immer aktuellste values aus draft nehmen
                      values: Object.fromEntries(
                        selectedSectionData.keys.map((k) => [
                          k,
                          currentDraft?.[k] ?? "",
                        ])
                      ),
                    }
                  : null
              }
              onChange={handleFieldChange}
              isSaving={saving}
              onOpenMediaPicker={() => navigate("/bodycam/media")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── JSON-Editor ────────────────────────────────────────────────────────────────

function JsonEditor({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  let isValid = true;
  try {
    JSON.parse(value);
  } catch {
    isValid = false;
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-2">
      {!isValid && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          Ungültiges JSON — Syntax prüfen
        </p>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 font-mono text-xs resize-none ${!isValid ? "border-red-400" : ""}`}
        spellCheck={false}
      />
    </div>
  );
}
