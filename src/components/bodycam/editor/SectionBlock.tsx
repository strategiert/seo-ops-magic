import { type ReactNode } from "react";

interface SectionBlockProps {
  sectionId: string;
  label: string;
  icon: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  children?: ReactNode;
  keyCount: number;
}

export function SectionBlock({
  sectionId,
  label,
  icon,
  isSelected,
  onSelect,
  children,
  keyCount,
}: SectionBlockProps) {
  return (
    <div
      className={`relative group rounded-lg border-2 transition-all duration-150 cursor-pointer ${
        isSelected
          ? "border-[#003366] shadow-md shadow-[#003366]/10"
          : "border-transparent hover:border-[#003366]/30"
      }`}
      onClick={() => onSelect(sectionId)}
    >
      {/* Section Label Badge */}
      <div
        className={`absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-opacity ${
          isSelected
            ? "opacity-100 bg-[#003366] text-white"
            : "opacity-0 group-hover:opacity-100 bg-[#003366]/80 text-white"
        }`}
      >
        <span>{icon}</span>
        <span>{label}</span>
        <span className="text-white/60">({keyCount})</span>
      </div>

      {/* Content */}
      <div className={`p-4 ${isSelected ? "bg-[#003366]/3" : ""}`}>
        {children ?? (
          <SectionDefaultPreview
            label={label}
            icon={icon}
            keyCount={keyCount}
          />
        )}
      </div>

      {/* Edit-Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-[#003366] text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
          Bearbeiten →
        </div>
      )}
    </div>
  );
}

function SectionDefaultPreview({
  label,
  icon,
  keyCount,
}: {
  label: string;
  icon: string;
  keyCount: number;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-2">
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground/60">
        {keyCount} {keyCount === 1 ? "Feld" : "Felder"}
      </span>
    </div>
  );
}
