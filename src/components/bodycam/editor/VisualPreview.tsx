import { useMemo } from "react";
import { groupContentBySection, type ContentSection } from "@/lib/sectionGroups";
import { SectionBlock } from "./SectionBlock";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VisualPreviewProps {
  content: Record<string, unknown> | null;
  selectedSection: string | null;
  onSelectSection: (id: string) => void;
  viewMode: "desktop" | "mobile";
  onViewModeChange: (mode: "desktop" | "mobile") => void;
}

export function VisualPreview({
  content,
  selectedSection,
  onSelectSection,
  viewMode,
  onViewModeChange,
}: VisualPreviewProps) {
  const sections = useMemo(() => {
    if (!content) return [];
    return groupContentBySection(content);
  }, [content]);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Diese Sprache wurde noch nicht importiert.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-xs text-muted-foreground">
          {sections.length} Sections · {Object.keys(content).length} Felder
        </span>
        <div className="flex-1" />
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => onViewModeChange("desktop")}
            className={`px-2 py-1.5 transition-colors ${
              viewMode === "desktop"
                ? "bg-[#003366] text-white"
                : "hover:bg-muted"
            }`}
            title="Desktop-Ansicht"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("mobile")}
            className={`px-2 py-1.5 transition-colors ${
              viewMode === "mobile"
                ? "bg-[#003366] text-white"
                : "hover:bg-muted"
            }`}
            title="Mobile-Ansicht"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={`mx-auto transition-all duration-300 ${
            viewMode === "mobile" ? "max-w-sm" : "max-w-none"
          }`}
        >
          {sections.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Keine Felder im Content-JSON gefunden.
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {sections.map((section) => (
                <SectionBlock
                  key={section.id}
                  sectionId={section.id}
                  label={section.label}
                  icon={section.icon}
                  isSelected={selectedSection === section.id}
                  onSelect={onSelectSection}
                  keyCount={section.keys.length}
                >
                  <SectionContentPreview
                    section={section}
                    isSelected={selectedSection === section.id}
                  />
                </SectionBlock>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Rendert eine Section als lesbare Preview (kein echtes Styling — zeigt Inhalte)
function SectionContentPreview({
  section,
  isSelected,
}: {
  section: ContentSection;
  isSelected: boolean;
}) {
  const displayEntries = Object.entries(section.values).slice(0, 5);
  const remaining = section.keys.length - displayEntries.length;

  return (
    <div className="space-y-1.5 mt-5">
      {displayEntries.map(([key, value]) => (
        <PreviewField key={key} fieldKey={key} value={String(value)} />
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground/60 pt-1">
          + {remaining} weitere {remaining === 1 ? "Feld" : "Felder"}
        </p>
      )}
      {isSelected && (
        <p className="text-xs text-[#003366] font-medium pt-1">
          ← Alle Felder im Properties-Panel rechts
        </p>
      )}
    </div>
  );
}

function PreviewField({
  fieldKey,
  value,
}: {
  fieldKey: string;
  value: string;
}) {
  const displayValue = value.replace(/<[^>]+>/g, "").trim(); // HTML-Tags entfernen
  const truncated =
    displayValue.length > 120
      ? displayValue.slice(0, 120) + "…"
      : displayValue;

  if (!truncated) return null;

  // Erkenne wichtige Felder für prominentere Darstellung
  const isHeadline =
    fieldKey.toLowerCase().includes("heading") ||
    fieldKey.toLowerCase().includes("headline") ||
    fieldKey.toLowerCase().includes("accent") ||
    fieldKey.toLowerCase().includes("title");

  return (
    <div className="flex gap-2 items-start">
      <span className="text-xs text-muted-foreground/50 font-mono shrink-0 w-32 truncate pt-0.5">
        {fieldKey}
      </span>
      <span
        className={`text-sm leading-snug ${
          isHeadline ? "font-semibold text-[#003366]" : "text-foreground/80"
        }`}
      >
        {truncated}
      </span>
    </div>
  );
}
