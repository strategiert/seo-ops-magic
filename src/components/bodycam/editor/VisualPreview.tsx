import { useMemo } from "react";
import { groupContentBySection, type ContentSection } from "@/lib/sectionGroups";
import { Monitor, Smartphone, Lock, Zap, ChevronRight } from "lucide-react";

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
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0">
        <span className="text-xs text-muted-foreground">
          {sections.length} Sektionen · {Object.keys(content).length} Felder
        </span>
        <div className="flex-1" />
        <div className="flex items-center border rounded overflow-hidden">
          <button
            onClick={() => onViewModeChange("desktop")}
            className={`px-2 py-1.5 transition-colors ${viewMode === "desktop" ? "bg-[#003366] text-white" : "hover:bg-muted"}`}
            title="Desktop-Ansicht"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("mobile")}
            className={`px-2 py-1.5 transition-colors ${viewMode === "mobile" ? "bg-[#003366] text-white" : "hover:bg-muted"}`}
            title="Mobile-Ansicht"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div
          className={`mx-auto transition-all duration-300 shadow-xl overflow-hidden ${
            viewMode === "mobile" ? "max-w-sm" : "max-w-2xl"
          }`}
        >
          {sections.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8 bg-white p-4">
              Keine Felder im Content-JSON gefunden.
            </div>
          ) : (
            sections.map((section) => (
              <SelectableSection
                key={section.id}
                section={section}
                isSelected={selectedSection === section.id}
                onSelect={onSelectSection}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Selectable wrapper ─────────────────────────────────────────────────────────

function SelectableSection({
  section,
  isSelected,
  onSelect,
}: {
  section: ContentSection;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`relative cursor-pointer group transition-all ${
        isSelected
          ? "outline outline-[3px] outline-[#003366] outline-offset-[-3px] z-10"
          : "hover:outline hover:outline-2 hover:outline-[#003366]/40 hover:outline-offset-[-2px]"
      }`}
      onClick={() => onSelect(section.id)}
    >
      {/* Section Label Badge */}
      <div
        className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-opacity ${
          isSelected
            ? "opacity-100 bg-[#003366] text-white"
            : "opacity-0 group-hover:opacity-90 bg-[#003366]/90 text-white"
        }`}
      >
        <span>{section.icon}</span>
        <span>{section.label}</span>
        <span className="text-white/60">({section.keys.length})</span>
      </div>

      {/* Edit Badge */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-20 bg-[#003366] text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
          Bearbeiten →
        </div>
      )}

      <SectionStyled section={section} />
    </div>
  );
}

// ── Section-type router ────────────────────────────────────────────────────────

function SectionStyled({ section }: { section: ContentSection }) {
  const v = section.values;
  switch (section.id) {
    case "hero":
      return <HeroSection v={v} />;
    case "news":
      return <NewsSection v={v} />;
    case "painpoints":
      return <PainPointsSection v={v} />;
    case "argument":
      return <ArgumentsSection v={v} />;
    case "dsgvo":
      return <DsgvoSection v={v} />;
    case "tech":
      return <TechSection v={v} />;
    case "product":
      return <ProductSection v={v} />;
    case "seo":
      return <SeoSection v={v} />;
    case "contact":
      return <GenericSection v={v} label={section.label} icon={section.icon} />;
    case "faq":
      return <FaqSection v={v} />;
    default:
      return <GenericSection v={v} label={section.label} icon={section.icon} />;
  }
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ v }: { v: Record<string, string> }) {
  const heading = v.heroAccent || v.heroHeading || "";
  const sub = [v.heroSub1, v.heroSub2].filter(Boolean).join(" ");
  const cta = v.ctaBeratung || v.ctaPrimary || "";

  return (
    <div
      className="px-8 py-12 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #003366 0%, #002855 55%, #001833 100%)" }}
    >
      {/* Dot-grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-white/20 rounded-full px-4 py-1.5 mb-5 bg-white/5">
          <span className="w-1.5 h-1.5 bg-[#ff6600] rounded-full animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">Made in Germany</span>
        </div>

        {heading && (
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-[1.15]">
            <span className="text-[#ff6600]">{heading.split(" ")[0]}</span>
            {heading.includes(" ") && ` ${heading.split(" ").slice(1).join(" ")}`}
          </h1>
        )}

        {sub && (
          <p className="text-slate-200/90 text-base mb-7 max-w-xl leading-relaxed">{sub}</p>
        )}

        {cta && (
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff6600] hover:bg-[#e55500] text-white font-semibold rounded-lg text-sm transition-colors">
            {cta}
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Stats row */}
        <div className="mt-8 pt-6 border-t border-white/10 flex gap-8">
          {[
            { val: "75%", label: "Deeskalation" },
            { val: "20h", label: "Akkulaufzeit" },
            { val: "100%", label: "DSGVO-konform" },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-[#ff6600]">{val}</div>
              <div className="text-xs text-slate-300 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── News / Presse ─────────────────────────────────────────────────────────────

function NewsSection({ v }: { v: Record<string, string> }) {
  const heading = v.tagesschauHeading || "";
  const text = v.tagesschauText || "";
  const videoTitle = v.videoTitle || "";

  return (
    <div className="bg-white px-8 py-8">
      <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1 mb-4">
        <span className="text-red-600 text-xs font-bold uppercase tracking-wider">📺 Presse & News</span>
      </div>

      {heading && (
        <h2 className="text-xl font-bold text-[#003366] mb-3 leading-snug">{heading}</h2>
      )}

      {text && (
        <div
          className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: text.length > 300 ? text.slice(0, 300) + "…" : text,
          }}
        />
      )}

      {videoTitle && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs">▶</span>
          </div>
          <span className="text-sm font-medium text-gray-700">{videoTitle}</span>
        </div>
      )}
    </div>
  );
}

// ── Pain Points ───────────────────────────────────────────────────────────────

function PainPointsSection({ v }: { v: Record<string, string> }) {
  const heading = v.mitarbeiterschutzHeading || "";
  const accent = v.mitarbeiterschutzAccent || "";

  const bullets: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const text = `${v[`bullet${i}pre`] ?? ""}${v[`bullet${i}bold`] ?? ""}${v[`bullet${i}post`] ?? ""}`.trim();
    if (text) bullets.push(text);
  }

  return (
    <div className="bg-slate-50 px-8 py-8">
      {heading && <p className="text-sm text-gray-400 mb-1">{heading}</p>}
      {accent && (
        <h2 className="text-xl font-bold text-[#003366] mb-5 leading-snug">{accent}</h2>
      )}

      {bullets.length > 0 && (
        <div className="space-y-2.5">
          {bullets.slice(0, 6).map((b, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100"
            >
              <div className="w-5 h-5 bg-[#ff6600]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[#ff6600] text-xs font-bold">!</span>
              </div>
              <span className="text-sm text-gray-700">{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Arguments ─────────────────────────────────────────────────────────────────

function ArgumentsSection({ v }: { v: Record<string, string> }) {
  const items = [
    { heading: v.schrittVorausHeading, text: v.schrittVorausText },
    { heading: v.bedienungHeading, text: v.bedienungText1 },
  ].filter((item) => item.heading || item.text);

  if (!items.length) return <GenericSection v={v} label="Argumente" icon="💡" />;

  return (
    <div className="bg-white px-8 py-8">
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="w-8 h-8 bg-[#003366]/10 rounded-xl flex items-center justify-center mb-3">
              <span className="text-[#003366] text-sm font-bold">{i + 1}</span>
            </div>
            {item.heading && (
              <h3 className="font-bold text-[#003366] text-sm mb-2">{item.heading}</h3>
            )}
            {item.text && (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                {item.text.replace(/<[^>]+>/g, "").slice(0, 180)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DSGVO / Datenschutz ───────────────────────────────────────────────────────

function DsgvoSection({ v }: { v: Record<string, string> }) {
  const heading = v.dsgvoHeading || "";
  const accent = v.dsgvoAccent || "";
  const text1 = v.dsgvoText1 || "";
  const quote = v.ceoQuote || "";

  return (
    <div
      className="px-8 py-8 text-white"
      style={{ background: "linear-gradient(135deg, #003366, #00264d)" }}
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
          <Lock className="h-5 w-5 text-white" />
        </div>
        <div>
          {heading && <p className="text-sm text-slate-300 mb-0.5">{heading}</p>}
          {accent && (
            <h2 className="text-lg font-bold text-white leading-snug">{accent}</h2>
          )}
        </div>
      </div>

      {text1 && (
        <p className="text-sm text-slate-200 leading-relaxed mb-5 max-w-lg">
          {text1.slice(0, 220)}{text1.length > 220 ? "…" : ""}
        </p>
      )}

      {/* DSGVO checkmarks */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {["AES-256 Verschlüsselung", "Server in Deutschland", "DSGVO-konform"].map((item) => (
          <div key={item} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
            <span className="text-green-400 text-sm">✓</span>
            <span className="text-xs text-slate-200">{item}</span>
          </div>
        ))}
      </div>

      {quote && (
        <blockquote className="border-l-2 border-[#ff6600] pl-4 text-sm italic text-slate-300 max-w-lg">
          "{quote.slice(0, 180)}{quote.length > 180 ? "…" : ""}"
        </blockquote>
      )}
    </div>
  );
}

// ── Technik ───────────────────────────────────────────────────────────────────

function TechSection({ v }: { v: Record<string, string> }) {
  const heading = v.techHeading || "";
  const text = v.techText1 || "";

  const specs = [
    v.specStaub && { label: v.specStaub, icon: "💧" },
    v.specAkku && { label: v.specAkku, icon: "🔋" },
    v.specGps && { label: v.specGps, icon: "📍" },
    v.specLte && { label: v.specLte, icon: "📡" },
    v.specBt && { label: v.specBt, icon: "📶" },
    v.specTemp && { label: v.specTemp, icon: "🌡️" },
  ].filter(Boolean) as { label: string; icon: string }[];

  return (
    <div className="bg-slate-900 px-8 py-8 text-white">
      {heading && <h2 className="text-xl font-bold text-white mb-3">{heading}</h2>}
      {text && (
        <p className="text-sm text-slate-300 leading-relaxed mb-6 max-w-xl">
          {text.replace(/<[^>]+>/g, "").slice(0, 220)}{text.length > 220 ? "…" : ""}
        </p>
      )}

      {specs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center"
            >
              <div className="text-xl mb-1">{spec.icon}</div>
              <div className="text-xs text-slate-300 font-medium leading-snug">{spec.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Produkt ───────────────────────────────────────────────────────────────────

function ProductSection({ v }: { v: Record<string, string> }) {
  const subtitle = v.proSubtitle || "";

  const features: { title: string; desc: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const title = v[`proFeat${i}Title`] || "";
    const desc = v[`proFeat${i}Desc`] || "";
    if (title) features.push({ title, desc });
  }

  return (
    <div className="bg-white px-8 py-8">
      {subtitle && (
        <p className="text-sm text-gray-500 mb-5 max-w-xl leading-relaxed">
          {subtitle.slice(0, 150)}{subtitle.length > 150 ? "…" : ""}
        </p>
      )}

      {features.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="border border-slate-100 rounded-xl p-4 hover:border-[#003366]/20 transition-colors"
            >
              <div className="w-7 h-7 bg-[#ff6600]/10 rounded-lg flex items-center justify-center mb-2">
                <Zap className="h-3.5 w-3.5 text-[#ff6600]" />
              </div>
              <div className="text-sm font-semibold text-[#003366] mb-1">{feat.title}</div>
              <div className="text-xs text-gray-500 leading-snug">
                {feat.desc.slice(0, 90)}{feat.desc.length > 90 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SEO / Meta ────────────────────────────────────────────────────────────────

function SeoSection({ v }: { v: Record<string, string> }) {
  const title = v.title || v.metaTitle || "";
  const description = v.description || v.metaDescription || "";

  return (
    <div className="bg-gray-50 px-8 py-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-medium">
        🔍 Google-Vorschau
      </p>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm max-w-lg">
        <p className="text-xs text-gray-400 mb-1">netco.de › body-cam › …</p>
        <p className="text-blue-700 text-sm font-medium mb-1 leading-snug">
          {title || <span className="text-gray-400 italic">Kein Title gesetzt</span>}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          {description.slice(0, 160) ||
            <span className="text-gray-400 italic">Keine Meta-Description gesetzt</span>}
        </p>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FaqSection({ v }: { v: Record<string, string> }) {
  const entries = Object.entries(v)
    .filter(([, val]) => val)
    .slice(0, 5);

  return (
    <div className="bg-white px-8 py-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
        ❓ FAQ
      </p>
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="border border-gray-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-[#003366] mb-1 font-mono">{key}</p>
            <p className="text-xs text-gray-600 leading-snug">
              {val.replace(/<[^>]+>/g, "").slice(0, 120)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic fallback ──────────────────────────────────────────────────────────

function GenericSection({
  v,
  label,
  icon,
}: {
  v: Record<string, string>;
  label: string;
  icon: string;
}) {
  const entries = Object.entries(v)
    .filter(([, val]) => val)
    .slice(0, 5);

  return (
    <div className="bg-white px-8 py-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
        {icon} {label}
      </p>
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-3 items-start">
            <span className="text-gray-400 font-mono text-xs w-32 shrink-0 pt-0.5 truncate">
              {key}
            </span>
            <span className="text-sm text-gray-700 leading-snug">
              {val.replace(/<[^>]+>/g, "").slice(0, 150)}
              {val.length > 150 ? "…" : ""}
            </span>
          </div>
        ))}
        {Object.keys(v).length > 5 && (
          <p className="text-xs text-muted-foreground/60 pt-1">
            + {Object.keys(v).length - 5} weitere Felder
          </p>
        )}
      </div>
    </div>
  );
}
