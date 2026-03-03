import { useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { Globe, Image, Upload, RefreshCw, CheckCircle2, FileEdit, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

// Alle unterstützten Seiten der bodycam Website
const BODYCAM_PAGES = [
  "page-homepage", "page-software", "page-preise", "page-technik",
  "page-dsgvo", "page-konferenz", "page-fachdialog", "page-zubehoer",
  "page-krankenhaus", "page-referenzen", "page-blog", "page-presse",
  "page-faq", "page-unternehmen", "page-impressum", "page-datenschutz",
  "page-branchen", "page-branchen-oepnv", "page-branchen-polizei",
  "page-branchen-ordnungsamt", "page-branchen-sicherheitsdienste",
  "page-cmo-system", "page-agent-knowledge",
];

const LANGS = ["de", "en", "nl", "fr", "es", "it"];

export default function BodycamDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const allPages = useQuery(api.tables.bodycam.listPages, {});
  const dirtyPages = useQuery(api.tables.bodycam.listDirtyPages, {});
  const media = useQuery(api.tables.bodycam.listMedia, {});

  const importPages = useAction(api.actions.bodycam.importPagesFromGitHub);
  const publishAll = useAction(api.actions.bodycam.publishAllDirtyPages);

  const totalPages = allPages?.length ?? 0;
  const dirtyCount = dirtyPages?.length ?? 0;
  const mediaCount = media?.length ?? 0;

  const handleImport = async () => {
    setImporting(true);
    try {
      const results = await importPages({ pageKeys: BODYCAM_PAGES });
      const imported = results.filter((r: any) => r.status === "imported").length;
      toast({
        title: "Import abgeschlossen",
        description: `${imported} Seiten aus GitHub importiert.`,
      });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handlePublishAll = async () => {
    if (dirtyCount === 0) {
      toast({ title: "Nichts zu publizieren", description: "Alle Seiten sind aktuell." });
      return;
    }
    setPublishing(true);
    try {
      const result = await publishAll({});
      toast({
        title: "Veröffentlicht",
        description: `${result.published} Seiten committed. CF Pages Rebuild läuft (~2 Min).`,
      });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AppLayout
      title="Bodycam CMS"
      breadcrumbs={[{ label: "Sites" }, { label: "Bodycam" }]}
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Globe className="h-5 w-5 text-blue-500" />}
            label="Seiten importiert"
            value={totalPages}
            sub={`aus ${BODYCAM_PAGES.length} × ${LANGS.length} Sprachen`}
          />
          <StatCard
            icon={<FileEdit className="h-5 w-5 text-amber-500" />}
            label="Ausstehende Publizierungen"
            value={dirtyCount}
            sub={dirtyCount > 0 ? "Noch nicht live" : "Alles aktuell"}
            urgent={dirtyCount > 0}
          />
          <StatCard
            icon={<Image className="h-5 w-5 text-green-500" />}
            label="Bilder in R2"
            value={mediaCount}
            sub="Hochgeladene Assets"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aus GitHub importieren
          </Button>

          <Button
            onClick={handlePublishAll}
            disabled={publishing || dirtyCount === 0}
            className="bg-[#003366] hover:bg-[#002244] text-white"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Alle publizieren {dirtyCount > 0 && `(${dirtyCount})`}
          </Button>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NavCard
            icon={<FileEdit className="h-5 w-5" />}
            title="Seiten bearbeiten"
            description="Alle Seiteninhalte in 6 Sprachen bearbeiten und publizieren"
            onClick={() => navigate("/bodycam/pages")}
            badge={dirtyCount > 0 ? `${dirtyCount} ausstehend` : undefined}
          />
          <NavCard
            icon={<Image className="h-5 w-5" />}
            title="Bilder verwalten"
            description="Bilder hochladen (R2) und URLs kopieren"
            onClick={() => navigate("/bodycam/media")}
          />
        </div>

        {/* Dirty Pages List */}
        {dirtyCount > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-amber-500" />
              Ausstehende Änderungen
            </h3>
            <div className="space-y-1">
              {dirtyPages?.map((page: any) => (
                <div
                  key={`${page.pageKey}/${page.lang}`}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => navigate(`/bodycam/pages/${page.pageKey}`)}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {page.pageKey}
                  </span>
                  <Badge variant="outline" className="text-xs ml-2">
                    {page.lang}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Erstimport Hinweis */}
        {totalPages === 0 && (
          <div className="border rounded-lg p-6 text-center text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Noch keine Seiten importiert</p>
            <p className="text-sm mt-1">
              Klicke auf "Aus GitHub importieren" um alle Seiteninhalte zu laden.
            </p>
            <p className="text-xs mt-3 text-amber-600">
              Voraussetzung: GITHUB_PAT muss in den Convex Environment Variables gesetzt sein.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  urgent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${urgent ? "border-amber-200 bg-amber-50" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function NavCard({
  icon,
  title,
  description,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="border rounded-lg p-4 text-left hover:bg-muted/50 transition-colors w-full"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{title}</span>
            {badge && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}
