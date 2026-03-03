import { useNavigate } from "react-router-dom";
import { useQuery, useConvexAuth } from "convex/react";
import { FileEdit, CheckCircle2, AlertCircle, Globe } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "../../convex/_generated/api";
import { useState, useMemo } from "react";

const LANGS = ["de", "en", "nl", "fr", "es", "it"];

const LANG_LABELS: Record<string, string> = {
  de: "🇩🇪 DE",
  en: "🇬🇧 EN",
  nl: "🇳🇱 NL",
  fr: "🇫🇷 FR",
  es: "🇪🇸 ES",
  it: "🇮🇹 IT",
};

export default function BodycamPagesList() {
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const allPages = useQuery(api.tables.bodycam.listPages, isAuthenticated ? {} : "skip");

  // Gruppiere nach pageKey
  const grouped = useMemo(() => {
    if (!allPages) return {};
    const map: Record<string, Record<string, any>> = {};
    for (const page of allPages) {
      if (!map[page.pageKey]) map[page.pageKey] = {};
      map[page.pageKey][page.lang] = page;
    }
    return map;
  }, [allPages]);

  const pageKeys = useMemo(() => {
    let keys = Object.keys(grouped).sort();
    if (search) {
      keys = keys.filter((k) => k.includes(search.toLowerCase()));
    }
    if (statusFilter === "dirty") {
      keys = keys.filter((k) =>
        LANGS.some((l) => grouped[k][l]?.isDirty)
      );
    } else if (statusFilter === "published") {
      keys = keys.filter((k) =>
        LANGS.every((l) => !grouped[k][l]?.isDirty)
      );
    }
    return keys;
  }, [grouped, search, statusFilter]);

  const filteredLangs = langFilter === "all" ? LANGS : [langFilter];

  return (
    <AppLayout
      title="Seiten"
      breadcrumbs={[
        { label: "Bodycam", href: "/bodycam" },
        { label: "Seiten" },
      ]}
    >
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Seite suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={langFilter} onValueChange={setLangFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Sprachen</SelectItem>
              {LANGS.map((l) => (
                <SelectItem key={l} value={l}>
                  {LANG_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="dirty">Ausstehend</SelectItem>
              <SelectItem value="published">Aktuell</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabelle */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Seite
                </th>
                {filteredLangs.map((l) => (
                  <th
                    key={l}
                    className="text-center px-3 py-2.5 font-medium text-muted-foreground"
                  >
                    {LANG_LABELS[l]}
                  </th>
                ))}
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {pageKeys.length === 0 ? (
                <tr>
                  <td
                    colSpan={filteredLangs.length + 2}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {allPages?.length === 0
                      ? "Noch keine Seiten importiert. Dashboard → Aus GitHub importieren."
                      : "Keine Seiten gefunden."}
                  </td>
                </tr>
              ) : (
                pageKeys.map((pageKey) => (
                  <tr
                    key={pageKey}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/bodycam/pages/${pageKey}`)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">{pageKey}</td>
                    {filteredLangs.map((l) => {
                      const page = grouped[pageKey]?.[l];
                      return (
                        <td key={l} className="text-center px-3 py-2.5">
                          {!page ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : page.isDirty ? (
                            <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5">
                      <FileEdit className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legende */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Aktuell
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Ausstehend (nicht publiziert)
          </span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground/40">—</span> Nicht importiert
          </span>
        </div>
      </div>
    </AppLayout>
  );
}
