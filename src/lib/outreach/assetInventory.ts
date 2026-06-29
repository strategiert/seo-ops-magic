export type AssetInventorySourceLink = string | { url?: string; href?: string; title?: string; text?: string };

export type AssetInventoryCrawlPage = {
  id?: string;
  url?: string;
  title?: string;
  pageType?: string;
  contentExcerpt?: string;
  headings?: unknown;
  internalLinks?: AssetInventorySourceLink[];
  externalLinks?: AssetInventorySourceLink[];
};

export type AssetInventoryContentAsset = {
  id?: string;
  assetType?: string;
  title?: string;
  platform?: string;
  contentExcerpt?: string;
  metadata?: unknown;
  status?: string;
};

export type AssetInventoryContext = {
  crawlPages?: AssetInventoryCrawlPage[];
  contentAssets?: AssetInventoryContentAsset[];
};

export type AssetInventorySitemap = {
  urls?: Array<{ url?: string; source?: string }>;
};

export type ExistingOutreachAsset = {
  assetType:
    | "calculator"
    | "tool"
    | "pdf_download"
    | "template"
    | "whitepaper"
    | "checklist"
    | "study"
    | "glossary"
    | "resource_page";
  label: string;
  title: string;
  url?: string;
  sourceKind: "crawl_link" | "crawl_page" | "content_asset" | "sitemap_url";
  sourceId?: string;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  evidence: string;
  score: number;
};

export type ResourceIdeaSeed = {
  recommendedFormat: string;
  angle: string;
  basedOn?: string;
};

export type OutreachAssetInventory = {
  existingAssets: ExistingOutreachAsset[];
  ideaSeeds: ResourceIdeaSeed[];
};

type AssetClassification = Pick<ExistingOutreachAsset, "assetType" | "label" | "score">;

const classifiers: Array<{
  match: RegExp;
  result: AssetClassification;
}> = [
  {
    match: /(rechner|kalkulator|calculator|roi|kostenrechner|budgetrechner|konfigurator)/i,
    result: { assetType: "calculator", label: "Rechner/Kalkulator", score: 0.96 },
  },
  {
    match: /(tool|generator|quiz|checker|scanner|assistent|konfigurator)/i,
    result: { assetType: "tool", label: "Tool", score: 0.93 },
  },
  {
    match: /(whitepaper|white paper|report|bericht|studie|analyse)/i,
    result: { assetType: "whitepaper", label: "Whitepaper/Report", score: 0.86 },
  },
  {
    match: /(\.pdf\b|download|downloads|dokument|dokumente|broschüre|broschuere|ebook|e-book|leitfaden)/i,
    result: { assetType: "pdf_download", label: "PDF/Download", score: 0.9 },
  },
  {
    match: /(vorlage|template|muster|formular|arbeitsblatt|worksheet)/i,
    result: { assetType: "template", label: "Vorlage", score: 0.88 },
  },
  {
    match: /(checkliste|checklist|spickzettel|notfallkarte|karte)/i,
    result: { assetType: "checklist", label: "Checkliste", score: 0.84 },
  },
  {
    match: /(umfrage|daten|benchmark|ranking|statistik)/i,
    result: { assetType: "study", label: "Studie/Daten", score: 0.8 },
  },
  {
    match: /(ressourcen|linksammlung|hilfreiche-links|resource)/i,
    result: { assetType: "resource_page", label: "Ressourcenseite", score: 0.7 },
  },
  {
    match: /(glossar|lexikon|wiki|begriff)/i,
    result: { assetType: "glossary", label: "Glossar/Lexikon", score: 0.46 },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function stringifySignal(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function linkToParts(link: AssetInventorySourceLink): { url?: string; text?: string } {
  if (typeof link === "string") return { url: link, text: link };
  if (!isRecord(link)) return {};

  const url = asString(link.url) || asString(link.href);
  const text = asString(link.title) || asString(link.text) || url;
  return { url, text };
}

function titleFromUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) =>
        decodeURIComponent(part)
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[-_]+/g, " ")
          .trim()
      )
      .filter(Boolean);

    return parts.at(-1) || fallback;
  } catch {
    return fallback;
  }
}

function classifyAsset(signal: string): AssetClassification | undefined {
  const normalized = signal.replace(/[-_]+/g, " ");
  return classifiers.find(({ match }) => match.test(normalized))?.result;
}

function dedupeAssets(assets: ExistingOutreachAsset[]): ExistingOutreachAsset[] {
  const byKey = new Map<string, ExistingOutreachAsset>();

  for (const asset of assets) {
    const key = `${asset.assetType}:${asset.url || asset.title}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing || asset.score > existing.score) {
      byKey.set(key, asset);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

function addIdeaSeed(
  seeds: ResourceIdeaSeed[],
  recommendedFormat: string,
  angle: string,
  basedOn?: string
) {
  if (seeds.some((seed) => seed.recommendedFormat === recommendedFormat && seed.angle === angle)) {
    return;
  }

  seeds.push({ recommendedFormat, angle, basedOn });
}

function buildIdeaSeeds(existingAssets: ExistingOutreachAsset[]): ResourceIdeaSeed[] {
  const seeds: ResourceIdeaSeed[] = [];

  for (const asset of existingAssets.slice(0, 12)) {
    if (asset.assetType === "calculator") {
      addIdeaSeed(
        seeds,
        "Rechner / Kalkulator",
        "Vorhandenen Rechner entkommerzialisieren, mit Methodik erklären und als zitierfähige Hilfeseite ausbauen.",
        asset.title
      );
      addIdeaSeed(
        seeds,
        "Kostenloses Tool",
        "Aus dem Rechner ein kleines frei nutzbares Tool mit Beispielszenarien und Embed-/Quellenbereich machen.",
        asset.title
      );
    }

    if (asset.assetType === "tool") {
      addIdeaSeed(
        seeds,
        "Kostenloses Tool",
        "Vorhandenes Tool als neutralen Problemlöser für Redaktionen und Fachseiten positionieren.",
        asset.title
      );
    }

    if (asset.assetType === "pdf_download" || asset.assetType === "checklist") {
      addIdeaSeed(
        seeds,
        "Checkliste",
        "Download in eine direkt nutzbare Checkliste mit offenem HTML-Preview und optionalem PDF verwandeln.",
        asset.title
      );
    }

    if (asset.assetType === "template") {
      addIdeaSeed(
        seeds,
        "Vorlage",
        "Vorlage als entkommerzialisierte Arbeitsgrundlage mit Beispielen, Anwendungsfällen und Quellenbereich ausbauen.",
        asset.title
      );
    }

    if (asset.assetType === "whitepaper" || asset.assetType === "study") {
      addIdeaSeed(
        seeds,
        "Report / Whitepaper",
        "Vorhandenes Dokument in eine zitierfähige Daten-/Methodik-Seite mit Grafiken und Kernerkenntnissen übersetzen.",
        asset.title
      );
    }
  }

  addIdeaSeed(
    seeds,
    "Kostenloses Tool",
    "Neues kleines Hilfstool bauen, das ein wiederkehrendes Leserproblem sofort löst.",
  );
  addIdeaSeed(
    seeds,
    "Rechner / Kalkulator",
    "Neuen Rechner für Kosten, Zeit, Risiko oder Nutzen aufsetzen, wenn die Marke dazu belastbare Annahmen liefern kann.",
  );
  addIdeaSeed(
    seeds,
    "Checkliste",
    "Neue praktische Checkliste für Redaktionen, Ratgeberseiten und Verbände planen.",
  );
  addIdeaSeed(
    seeds,
    "Studie / Datenauswertung",
    "Kleine eigene Auswertung aus öffentlich verfügbaren oder vorhandenen Daten entwickeln.",
  );

  return seeds.slice(0, 12);
}

export function buildAssetInventory(
  context: AssetInventoryContext,
  sitemap: AssetInventorySitemap
): OutreachAssetInventory {
  const assets: ExistingOutreachAsset[] = [];

  for (const page of context.crawlPages ?? []) {
    const pageSignal = [
      page.url,
      page.title,
      page.pageType,
      page.contentExcerpt,
      stringifySignal(page.headings),
    ].join(" ");
    const pageClassification = classifyAsset(pageSignal);

    if (pageClassification) {
      assets.push({
        ...pageClassification,
        title: page.title || titleFromUrl(page.url, pageClassification.label),
        url: page.url,
        sourceKind: "crawl_page",
        sourceId: page.id,
        sourcePageUrl: page.url,
        sourcePageTitle: page.title,
        evidence: page.contentExcerpt?.slice(0, 240) || pageSignal.slice(0, 240),
      });
    }

    for (const link of [...(page.internalLinks ?? []), ...(page.externalLinks ?? [])]) {
      const { url, text } = linkToParts(link);
      const primaryLinkSignal = [url, text].join(" ");
      const linkSignal = [primaryLinkSignal, page.title, page.contentExcerpt].join(" ");
      const classification =
        classifyAsset(primaryLinkSignal) || classifyAsset(linkSignal);
      if (!classification || !url) continue;

      assets.push({
        ...classification,
        title: text || titleFromUrl(url, classification.label),
        url,
        sourceKind: "crawl_link",
        sourceId: page.id,
        sourcePageUrl: page.url,
        sourcePageTitle: page.title,
        evidence: `Gefunden auf ${page.title || page.url || "Crawl-Seite"}`,
      });
    }
  }

  for (const asset of context.contentAssets ?? []) {
    const signal = [
      asset.assetType,
      asset.title,
      asset.platform,
      asset.contentExcerpt,
      stringifySignal(asset.metadata),
    ].join(" ");
    const classification = classifyAsset(signal);
    if (!classification) continue;

    assets.push({
      ...classification,
      title: asset.title || classification.label,
      sourceKind: "content_asset",
      sourceId: asset.id,
      evidence: asset.contentExcerpt?.slice(0, 240) || signal.slice(0, 240),
      score: Math.min(classification.score + 0.03, 1),
    });
  }

  for (const item of sitemap.urls ?? []) {
    const url = asString(item.url);
    if (!url) continue;

    const classification = classifyAsset(url);
    if (!classification) continue;

    assets.push({
      ...classification,
      title: titleFromUrl(url, classification.label),
      url,
      sourceKind: "sitemap_url",
      evidence: `Gefunden in ${item.source || "Sitemap"}`,
    });
  }

  const existingAssets = dedupeAssets(assets);

  return {
    existingAssets,
    ideaSeeds: buildIdeaSeeds(existingAssets),
  };
}
