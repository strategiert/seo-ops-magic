/**
 * Section-Grouping für bodycam contentJson
 * Gruppiert flache Key-Value-Paare nach Präfix zu benannten Sections
 */

export interface ContentSection {
  id: string;
  label: string;
  keys: string[];
  values: Record<string, string>;
  icon: string;
}

// Reihenfolge und Präfix-Mapping
const SECTION_DEFINITIONS: Array<{
  id: string;
  label: string;
  icon: string;
  prefixes: string[];
}> = [
  {
    id: "hero",
    label: "Hero",
    icon: "🏠",
    prefixes: ["hero", "cta"],
  },
  {
    id: "news",
    label: "News / Presse",
    icon: "📰",
    prefixes: ["tagesschau", "video"],
  },
  {
    id: "painpoints",
    label: "Pain Points",
    icon: "⚠️",
    prefixes: ["mitarbeiterschutz", "bullet"],
  },
  {
    id: "argument",
    label: "Argumente",
    icon: "💡",
    prefixes: ["schrittVoraus", "schritt", "bedienung"],
  },
  {
    id: "dsgvo",
    label: "Datenschutz / DSGVO",
    icon: "🔒",
    prefixes: ["dsgvo"],
  },
  {
    id: "tech",
    label: "Technik",
    icon: "⚙️",
    prefixes: ["tech", "spec"],
  },
  {
    id: "product",
    label: "Produkt",
    icon: "📦",
    prefixes: ["pro", "ceo"],
  },
  {
    id: "seo",
    label: "SEO / Meta",
    icon: "🔍",
    prefixes: ["meta", "seo", "og"],
  },
  {
    id: "contact",
    label: "Kontakt",
    icon: "📞",
    prefixes: ["contact", "kontakt", "adress", "phone", "email"],
  },
  {
    id: "faq",
    label: "FAQ",
    icon: "❓",
    prefixes: ["faq"],
  },
  {
    id: "legal",
    label: "Rechtliches",
    icon: "📋",
    prefixes: ["agb", "impress", "daten", "cookie"],
  },
];

// Exakte Einzel-Keys die immer zu SEO gehören
const SEO_EXACT_KEYS = new Set(["title", "description", "h1", "canonical"]);

function getKeyPrefix(key: string): string {
  // Kleinbuchstaben für Vergleich
  const lower = key.toLowerCase();
  return lower;
}

function matchesPrefix(key: string, prefix: string): boolean {
  const lower = key.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  return lower === lowerPrefix || lower.startsWith(lowerPrefix);
}

export function groupContentBySection(
  content: Record<string, unknown>
): ContentSection[] {
  const assignedKeys = new Set<string>();
  const sections: ContentSection[] = [];

  // Erst SEO-Exact-Keys zuweisen
  const seoExact: Record<string, string> = {};
  for (const key of Object.keys(content)) {
    if (SEO_EXACT_KEYS.has(key.toLowerCase())) {
      seoExact[key] = String(content[key] ?? "");
      assignedKeys.add(key);
    }
  }

  // Sections nach Definition befüllen
  for (const def of SECTION_DEFINITIONS) {
    const values: Record<string, string> = {};
    const keys: string[] = [];

    // Special case: SEO bekommt die exact-keys
    if (def.id === "seo") {
      Object.assign(values, seoExact);
      keys.push(...Object.keys(seoExact));
    }

    for (const key of Object.keys(content)) {
      if (assignedKeys.has(key)) continue;

      for (const prefix of def.prefixes) {
        if (matchesPrefix(key, prefix)) {
          values[key] = String(content[key] ?? "");
          keys.push(key);
          assignedKeys.add(key);
          break;
        }
      }
    }

    if (keys.length > 0) {
      sections.push({
        id: def.id,
        label: def.label,
        icon: def.icon,
        keys,
        values,
      });
    }
  }

  // Sonstiges: alle nicht zugewiesenen Keys
  const remainingKeys = Object.keys(content).filter(
    (k) => !assignedKeys.has(k)
  );
  if (remainingKeys.length > 0) {
    const values: Record<string, string> = {};
    for (const k of remainingKeys) {
      values[k] = String(content[k] ?? "");
    }
    sections.push({
      id: "misc",
      label: "Sonstiges",
      icon: "📝",
      keys: remainingKeys,
      values,
    });
  }

  return sections;
}

/** Hilfsfunktion: Gibt die Section-ID für einen bestimmten Key zurück */
export function getSectionForKey(key: string): string {
  if (SEO_EXACT_KEYS.has(key.toLowerCase())) return "seo";

  for (const def of SECTION_DEFINITIONS) {
    for (const prefix of def.prefixes) {
      if (matchesPrefix(key, prefix)) return def.id;
    }
  }
  return "misc";
}

/** Hilfsfunktion: Ist ein Key ein Bild-URL-Feld? */
export function isImageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("image") ||
    lower.includes("img") ||
    lower.includes("bild") ||
    lower.includes("foto") ||
    lower.includes("photo") ||
    lower.includes("src") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("thumbnail") ||
    lower.includes("banner")
  );
}

/** Hilfsfunktion: Ist ein Key ein langer Text? */
export function isLongTextField(key: string, value: string): boolean {
  const lower = key.toLowerCase();
  if (value.length > 80) return true;
  return (
    lower.includes("text") ||
    lower.includes("desc") ||
    lower.includes("intro") ||
    lower.includes("summary") ||
    lower.includes("content") ||
    lower.includes("body") ||
    lower.includes("quote") ||
    lower.includes("zitat")
  );
}

/** Hilfsfunktion: Enthält ein Wert HTML? */
export function isHtmlValue(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}
