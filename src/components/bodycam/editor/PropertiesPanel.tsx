import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image, Loader2, CheckCircle2, Code } from "lucide-react";
import {
  type ContentSection,
  isImageKey,
  isLongTextField,
  isHtmlValue,
} from "@/lib/sectionGroups";

interface PropertiesPanelProps {
  section: ContentSection | null;
  onChange: (key: string, value: string) => void;
  isSaving: boolean;
  onOpenMediaPicker?: () => void;
}

export function PropertiesPanel({
  section,
  onChange,
  isSaving,
  onOpenMediaPicker,
}: PropertiesPanelProps) {
  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
        <div className="text-4xl mb-3">👈</div>
        <p className="text-sm font-medium">Section auswählen</p>
        <p className="text-xs mt-1 text-muted-foreground/70">
          Klicke auf eine Section in der Vorschau um ihre Felder zu bearbeiten.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{section.icon}</span>
          <span className="font-semibold text-sm">{section.label}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {section.keys.length} {section.keys.length === 1 ? "Feld" : "Felder"}
          </Badge>
        </div>
        {isSaving && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Speichert…
          </div>
        )}
        {!isSaving && section.keys.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Änderungen werden automatisch gespeichert
          </div>
        )}
      </div>

      {/* Felder */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {section.keys.map((key) => (
          <PropertyField
            key={key}
            fieldKey={key}
            value={section.values[key] ?? ""}
            onChange={(val) => onChange(key, val)}
            onOpenMediaPicker={onOpenMediaPicker}
          />
        ))}
      </div>
    </div>
  );
}

interface PropertyFieldProps {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  onOpenMediaPicker?: () => void;
}

function PropertyField({
  fieldKey,
  value,
  onChange,
  onOpenMediaPicker,
}: PropertyFieldProps) {
  const isImage = isImageKey(fieldKey);
  const isLong = isLongTextField(fieldKey, value);
  const isHtml = isHtmlValue(value);

  // Label: camelCase → lesbarer Text
  const label = fieldKey
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground font-mono">
          {fieldKey}
        </Label>
        {isHtml && (
          <span title="HTML-Inhalt">
            <Code className="h-3 w-3 text-muted-foreground/50" />
          </span>
        )}
        {isImage && (
          <span title="Bild-URL">
            <Image className="h-3 w-3 text-muted-foreground/50" />
          </span>
        )}
      </div>

      {isImage ? (
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="text-xs font-mono flex-1"
          />
          {onOpenMediaPicker && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMediaPicker}
              title="Bild aus Mediathek wählen"
              className="shrink-0 px-2"
            >
              <Image className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : isLong || isHtml ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`text-sm min-h-[80px] resize-y ${isHtml ? "font-mono text-xs" : ""}`}
          placeholder={isHtml ? "<p>HTML-Inhalt…</p>" : "Text eingeben…"}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
          placeholder="Wert eingeben…"
        />
      )}

      {/* Bild-Preview wenn Image-URL gesetzt */}
      {isImage && value && value.startsWith("http") && (
        <img
          src={value}
          alt=""
          className="mt-1 w-full max-h-24 object-cover rounded border"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );
}
