import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { groupContentBySection } from "@/lib/sectionGroups";
import { useMemo } from "react";

/**
 * Öffentliche Vorschau-Seite für eine bodycam-Seite.
 * Kein Auth nötig. Route: /bodycam/preview/:pageKey/:lang
 */
export default function BodycamPreview() {
  const { pageKey, lang = "de" } = useParams<{ pageKey: string; lang: string }>();

  const page = useQuery(
    api.tables.bodycam.getPage,
    pageKey && lang ? { pageKey, lang } : "skip"
  );

  const content = useMemo(() => {
    if (!page?.contentJson) return null;
    try {
      return JSON.parse(page.contentJson) as Record<string, string>;
    } catch {
      return null;
    }
  }, [page]);

  const sections = useMemo(() => {
    if (!content) return [];
    return groupContentBySection(content);
  }, [content]);

  if (page === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003366]" />
      </div>
    );
  }

  if (!page || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-semibold">Seite nicht gefunden</p>
          <p className="text-sm mt-1">
            {pageKey}/{lang}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Preview-Banner */}
      <div className="bg-[#003366] text-white text-xs py-1.5 px-4 flex items-center gap-2">
        <span className="opacity-70">Vorschau:</span>
        <span className="font-mono">{pageKey}</span>
        <span className="uppercase opacity-50">{lang}</span>
        {page.isDirty && (
          <span className="ml-auto bg-[#ff6600] px-2 py-0.5 rounded text-xs">
            Unveröffentlichte Änderungen
          </span>
        )}
      </div>

      {/* Content Sections */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {sections.map((section) => (
          <PreviewSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

function PreviewSection({
  section,
}: {
  section: ReturnType<typeof groupContentBySection>[number];
}) {
  return (
    <section className="border rounded-lg overflow-hidden">
      {/* Section Header */}
      <div className="bg-[#003366]/5 border-b px-4 py-2 flex items-center gap-2">
        <span>{section.icon}</span>
        <span className="text-sm font-semibold text-[#003366]">{section.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {section.keys.length} Felder
        </span>
      </div>

      {/* Fields */}
      <div className="p-4 space-y-3">
        {section.keys.map((key) => {
          const value = section.values[key];
          if (!value) return null;

          const isHeading =
            key.toLowerCase().includes("heading") ||
            key.toLowerCase().includes("headline") ||
            key.toLowerCase().includes("accent") ||
            key.toLowerCase().includes("title");

          return (
            <div key={key} className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-mono">{key}</p>
              {isHeading ? (
                <p className="font-bold text-[#003366] text-lg leading-tight">
                  {value}
                </p>
              ) : value.includes("<") ? (
                <div
                  className="text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: value }}
                />
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
