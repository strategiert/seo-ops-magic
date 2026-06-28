import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { inngest } from "../../client.js";
import { api, convex, AGENT_CREDITS, calculateCostCents } from "../../lib/convex.js";
import { extractToolInput } from "../../lib/anthropicToolInput.js";
import {
  RESOURCE_FORMATS,
  normalizeResourcePlan,
} from "../../../lib/outreach/resourcePlans.js";
import type { ResourcePlan } from "../../../lib/outreach/resourcePlans.js";

const AGENT_ID = "outreach-intelligence";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];
const OUTREACH_INTELLIGENCE_TOOL_NAME = "submit_outreach_intelligence";

const SYSTEM_PROMPT = [
  "Du bist der Outreach Intelligence Agent für SEO Ops Magic.",
  "",
  "Deine Aufgabe: Verstehe zuerst die Marke, Website, vorhandenen Content und Sitemap. Danach planst du redaktionell verlinkbare Ressourcen, die fremde Websites ihren Lesern sinnvoll empfehlen können. Das Tool ist offen für SEO, PR, Sales und Partnerships; technisch ist es Outreach, die Positionierung unterscheidet sich je nach Ziel.",
  "",
  "Arbeite praktisch und kampagnenfähig:",
  "- Bewerte vorhandene Artikel, gecrawlte Seiten, HTML-Exports, Briefs, Assets, Sitemap-URLs und Brand-Daten.",
  "- Denke zuerst aus Sicht fremder Leser, Redaktionen, Vereine, Pädagogen, Portale, Fachblogs, Webmaster und Journalisten.",
  "- Linkerati sind nicht zwingend Kunden. Baue Ressourcen für Menschen, die verlinken können oder sollen.",
  "- Plane verlinkbare Ressourcen wie Ratgeber, Broschüren, Checklisten, Experteninterviews, Gruppeninterviews, Analysen, Umfragen, Whitepaper, Rechner, Tools, Vorlagen, Glossare, Presse-Ressourcen, Notfallkarten oder interaktive Visualisierungen.",
  "- Nenne die Ressource nie Linkbait, Linkmagnet oder Link-Magnet in publicName, claudeCodeBrief oder Outreach-Rohmaterial.",
  "- Intern darfst du Linkbait-Potenzial bewerten, aber extern nutzt du Begriffe wie Ressource, Ratgeber, Checkliste, Tool, Broschüre, PDF, Studie, Hilfsmittel oder weiterführende Information.",
  "- Prüfe die entkommerzialisierte Zone: keine Salesbotschaft, kein Warenkorb, keine aggressive Lead-Mechanik, keine Produktwerbung als Hauptzweck.",
  "- DACH-Linkaufbau braucht Tiefe, Seriosität, Quellen, Experten, echte Nützlichkeit und klare Leserhilfe.",
  "- Wenn vorhandener Content schwach ist, plane neue Assets. Erzeuge mindestens zwei `new_asset` Ideen.",
  "- Jede Opportunity braucht ein resourcePlan Objekt mit Formatentscheidung, Alternativen, Linkzielgruppen, Leserproblem, redaktionellem Wert, Linkgrund, Glaubwürdigkeitsplan, MVP-Scope, Claude-Code-Build-Brief und Outreach-Rohmaterial.",
  "- Gib konkrete Platzierungsideen auf fremden Seiten an, z.B. \"als weiterführende Information im Abschnitt X\".",
  "- Füll die Kampagne so weit wie möglich selbst aus. Keine Rückfragen, außer Daten fehlen komplett.",
  "- Schreibe auf Deutsch, klar, konkret und handlungsorientiert.",
  "- Vermeide rechtliche Belehrungen. Erwähne Risiken nur operativ, z.B. Relevanz, Spam-Signale, schwache Linkbarkeit.",
  "",
  "Antworte ausschließlich über das bereitgestellte Tool.",
].join("\n");

const FORMAT_SCORE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    readerBenefit: { type: "number" },
    editorialBenefit: { type: "number" },
    linkReason: { type: "number" },
    credibility: { type: "number" },
    effort: { type: "number" },
    evergreen: { type: "number" },
    dachFit: { type: "number" },
    outreachFit: { type: "number" },
    total: { type: "number" },
  },
  additionalProperties: true,
} as const;

const OUTREACH_RAW_MATERIAL_TOOL_SCHEMA = {
  type: "object",
  properties: {
    whyThisSite: { type: "string" },
    placementIdea: { type: "string" },
    pitchAngle: { type: "string" },
    searchOperators: { type: "array", items: { type: "string" } },
  },
  additionalProperties: true,
} as const;

const RESOURCE_PLAN_TOOL_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    publicName: { type: "string" },
    resourceType: { type: "string" },
    alternativeTypes: { type: "array", items: { type: "string" } },
    readerAudience: { type: "string" },
    linkAudiences: { type: "array", items: { type: "string" } },
    readerProblem: { type: "string" },
    editorialValue: { type: "string" },
    linkReason: { type: "string" },
    decommercialization: { type: "array", items: { type: "string" } },
    credibilityPlan: { type: "array", items: { type: "string" } },
    formatScore: FORMAT_SCORE_TOOL_SCHEMA,
    mvpScope: { type: "array", items: { type: "string" } },
    claudeCodeBrief: { type: "string" },
    outreachRawMaterial: OUTREACH_RAW_MATERIAL_TOOL_SCHEMA,
  },
  required: [
    "publicName",
    "resourceType",
    "readerAudience",
    "linkAudiences",
    "readerProblem",
    "editorialValue",
    "linkReason",
    "formatScore",
    "mvpScope",
    "claudeCodeBrief",
    "outreachRawMaterial",
  ],
  additionalProperties: true,
} as const;

const OUTREACH_INTELLIGENCE_TOOL: Tool = {
  name: OUTREACH_INTELLIGENCE_TOOL_NAME,
  description:
    "Gibt die Outreach-Intelligence als strukturierte Daten zurück.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      sourceCoverage: {
        type: "object",
        properties: {
          usedSources: { type: "array", items: { type: "string" } },
          missingSources: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        additionalProperties: true,
      },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            contentType: { type: "string" },
            sourceKind: { type: "string" },
            sourceId: { type: "string" },
            sourceUrl: { type: "string" },
            targetArticleId: { type: "string" },
            score: { type: "number" },
            effort: { type: "string" },
            linkabilityReasons: { type: "array", items: { type: "string" } },
            audiences: { type: "array", items: { type: "string" } },
            recommendedAssetUpgrade: { type: "string" },
            outreachAngles: { type: "array", items: { type: "string" } },
            searchOperators: { type: "array", items: { type: "string" } },
            campaignName: { type: "string" },
            resourcePlan: RESOURCE_PLAN_TOOL_SCHEMA,
          },
          required: ["title", "resourcePlan"],
          additionalProperties: true,
        },
      },
      recommendedCampaign: {
        type: "object",
        properties: {
          name: { type: "string" },
          targetDomain: { type: "string" },
          goals: { type: "string" },
          strategy: {
            type: "object",
            properties: {
              summary: { type: "string" },
              positioning: { type: "string" },
              recommendedMethods: { type: "array", items: { type: "string" } },
              searchOperators: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              nextActions: { type: "array", items: { type: "string" } },
            },
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
    },
    required: ["summary", "sourceCoverage", "opportunities", "recommendedCampaign"],
    additionalProperties: true,
  },
};

type OutreachIntelligenceEventData = {
  projectId: string;
  analysisId?: string;
  userId: string;
  workspaceId: string;
  customerId: string;
};

type ContextProject = {
  _id?: string;
  name?: string;
  domain?: string;
  wpUrl?: string;
  defaultLanguage?: string;
  defaultCountry?: string;
  defaultTargetAudience?: string;
};

type ContextArticle = {
  id?: string;
  title?: string;
  primaryKeyword?: string;
  status?: string;
  metaDescription?: string;
  contentExcerpt?: string;
};

type IntelligenceContext = {
  project?: ContextProject;
  brandProfile?: Record<string, unknown> | null;
  crawlPages?: Array<Record<string, unknown>>;
  articles?: ContextArticle[];
  briefs?: Array<Record<string, unknown>>;
  htmlExports?: Array<Record<string, unknown>>;
  contentAssets?: Array<Record<string, unknown>>;
  integrations?: Array<Record<string, unknown>>;
  gscConnection?: Record<string, unknown> | null;
  dashboardPages?: Array<Record<string, unknown>>;
};

type SitemapDiscovery = {
  origin?: string;
  sitemapUrls: string[];
  urls: Array<{ url: string; source: string }>;
  errors: string[];
  fetchedAt: number;
};

type GeneratedOpportunity = {
  title: string;
  contentType: string;
  sourceKind: string;
  sourceId?: string;
  sourceUrl?: string;
  targetArticleId?: string;
  score: number;
  effort: string;
  linkabilityReasons: string[];
  audiences: string[];
  recommendedAssetUpgrade: string;
  outreachAngles: string[];
  searchOperators: string[];
  campaignName: string;
  resourcePlan: ResourcePlan;
};

type CampaignStrategy = {
  summary: string;
  positioning: string;
  recommendedMethods: string[];
  searchOperators: string[];
  risks: string[];
  nextActions: string[];
};

type RecommendedCampaign = {
  name: string;
  targetDomain?: string;
  goals: string;
  strategy: CampaignStrategy;
};

type GeneratedIntelligence = {
  summary: string;
  sourceCoverage: Record<string, unknown>;
  opportunities: GeneratedOpportunity[];
  recommendedCampaign: RecommendedCampaign;
};

function getWorkerSecret(): string {
  const workerSecret = process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;
  if (!workerSecret) {
    throw new Error("OUTREACH_WORKER_SECRET is not configured");
  }
  return workerSecret;
}

function safeStringify(value: unknown, maxLength: number): string {
  const text = JSON.stringify(value, null, 2) || "";
  return text.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function clampScore(value: unknown): number {
  const score = asNumber(value) ?? 0.5;
  if (score > 1) return Math.min(score / 100, 1);
  return Math.max(0, Math.min(score, 1));
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return undefined;
  }
}

function getProjectOrigin(project: ContextProject | undefined): string | undefined {
  return normalizeOrigin(project?.domain) || normalizeOrigin(project?.wpUrl);
}

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const loc = xmlDecode(match[1]).trim();
    if (loc) locs.push(loc);
  }

  return locs;
}

function extractRobotsSitemaps(robots: string): string[] {
  return robots
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
    .filter(Boolean);
}

async function fetchTextWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/xml,text/xml,text/plain,*/*",
        "User-Agent": "SEO-Ops-Magic-Outreach-Intelligence/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return (await response.text()).slice(0, 2_000_000);
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeSitemapUrl(url: string): boolean {
  return /sitemap/i.test(url) || /\.xml($|\?)/i.test(url);
}

async function discoverSitemap(origin: string | undefined): Promise<SitemapDiscovery> {
  const result: SitemapDiscovery = {
    origin,
    sitemapUrls: [],
    urls: [],
    errors: [],
    fetchedAt: Date.now(),
  };

  if (!origin) {
    result.errors.push("Projekt hat keine Domain oder WordPress-URL.");
    return result;
  }

  const queue: string[] = [];

  try {
    const robots = await fetchTextWithTimeout(`${origin}/robots.txt`, 5000);
    queue.push(...extractRobotsSitemaps(robots));
  } catch (error) {
    result.errors.push(
      `robots.txt konnte nicht gelesen werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  }

  queue.push(
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/post-sitemap.xml`,
    `${origin}/page-sitemap.xml`
  );

  const seenSitemaps = new Set<string>();
  const seenUrls = new Set<string>();

  while (queue.length > 0 && seenSitemaps.size < 12 && result.urls.length < 120) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;

    seenSitemaps.add(sitemapUrl);
    result.sitemapUrls.push(sitemapUrl);

    try {
      const xml = await fetchTextWithTimeout(sitemapUrl, 8000);
      const locs = extractLocs(xml);

      for (const loc of locs) {
        if (looksLikeSitemapUrl(loc) && seenSitemaps.size + queue.length < 12) {
          queue.push(loc);
          continue;
        }

        if (!seenUrls.has(loc)) {
          seenUrls.add(loc);
          result.urls.push({ url: loc, source: sitemapUrl });
        }

        if (result.urls.length >= 120) break;
      }
    } catch (error) {
      result.errors.push(
        `${sitemapUrl} konnte nicht gelesen werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`
      );
    }
  }

  return result;
}

function fallbackOpportunity(context: IntelligenceContext): GeneratedOpportunity {
  const article = context.articles?.[0];
  const crawlPage = context.crawlPages?.[0];
  const title =
    article?.title ||
    asString(crawlPage?.title) ||
    `${context.project?.name || "Projekt"} Outreach Asset`;

  return {
    title,
    contentType: article ? "blog" : "landing_page",
    sourceKind: article ? "article" : "crawl_page",
    sourceId: article?.id || asString(crawlPage?.id),
    sourceUrl: asString(crawlPage?.url),
    targetArticleId: article?.id,
    score: 0.62,
    effort: "medium",
    linkabilityReasons: [
      "Vorhandener Content kann als Outreach-Aufhänger weiterentwickelt werden.",
      "Die Datenlage reicht für eine erste Kampagnenstruktur.",
    ],
    audiences: ["Redaktionen", "Branchenblogs", "Ressourcenseiten"],
    recommendedAssetUpgrade:
      "Aus dem Content eine konkrete redaktionelle Ressource bauen, z.B. Checkliste, Mini-Studie, Template oder interaktives Tool.",
    outreachAngles: [
      "Hilfreiche Ressource für bestehende Artikel und Ressourcenseiten.",
      "Ergänzung für Inhalte, die praktische Tools oder aktuelle Beispiele sammeln.",
    ],
    searchOperators: [
      '"Ressourcen" + Keyword',
      '"hilfreiche Links" + Keyword',
      '"Gastbeitrag" + Keyword',
    ],
    campaignName: `${title} Outreach`,
    resourcePlan: normalizeResourcePlan(
      {
        title,
        publicName: title,
        resourceType: article ? "Ratgeber / Broschüre" : "Checkliste",
        alternativeTypes: ["PDF zum Ausdrucken", "FAQ"],
        readerAudience: "Leser der relevanten Fach- und Ratgeberseiten",
        linkAudiences: ["Redaktionen", "Branchenblogs", "Ressourcenseiten"],
        readerProblem:
          "Leser brauchen eine konkrete, neutrale und gut nutzbare Vertiefung zum Thema.",
        editorialValue:
          "Die Ressource kann bestehende Artikel als weiterführende Information ergänzen.",
        linkReason:
          "Kostenlose Ressource mit praktischem Nutzen für Leser und klarer thematischer Nähe.",
        decommercialization: [
          "Keine Produktwerbung im Hauptinhalt",
          "Ressource als neutrale Hilfeseite aufbauen",
        ],
        credibilityPlan: [
          "Quellen sichtbar machen",
          "Methodik oder fachliche Grundlage kurz erklären",
        ],
        formatScore: {
          readerBenefit: 0.62,
          editorialBenefit: 0.58,
          linkReason: 0.6,
          credibility: 0.52,
          effort: 0.45,
          evergreen: 0.66,
          dachFit: 0.62,
          outreachFit: 0.58,
          total: 0.6,
        },
        mvpScope: [
          "Entkommerzialisierte Ressourcen-Seite",
          "Klares Leserproblem",
          "Quellenbox",
          "Weiterführende PDF- oder Checklisten-Version",
        ],
        claudeCodeBrief:
          "Baue eine entkommerzialisierte Ressourcen-Seite mit klarem Leserproblem, neutraler Einordnung, praktischen Schritten, Quellenbox und optionalem PDF-Download.",
        outreachRawMaterial: {
          whyThisSite:
            "Die Zielseite behandelt ein thematisch passendes Leserproblem.",
          placementIdea:
            "Als weiterführende Information in einem bestehenden Ratgeberabschnitt.",
          pitchAngle:
            "Kostenlose Ressource als praktische Ergänzung für Leser.",
          searchOperators: [
            '"Ressourcen" + Keyword',
            '"hilfreiche Links" + Keyword',
            '"Ratgeber" + Keyword',
          ],
        },
      },
      title
    ),
  };
}

function normalizeOpportunity(value: Record<string, unknown>): GeneratedOpportunity | null {
  const title = asString(value.title);
  if (!title) return null;
  const resourcePlan = normalizeResourcePlan(
    isRecord(value.resourcePlan) ? value.resourcePlan : value,
    title
  );

  return {
    title,
    contentType: asString(value.contentType) || "other",
    sourceKind: asString(value.sourceKind) || "new_asset",
    sourceId: asString(value.sourceId),
    sourceUrl: asString(value.sourceUrl),
    targetArticleId: asString(value.targetArticleId),
    score: clampScore(value.score),
    effort: asString(value.effort) || "medium",
    linkabilityReasons: asStringArray(value.linkabilityReasons),
    audiences: asStringArray(value.audiences),
    recommendedAssetUpgrade:
      asString(value.recommendedAssetUpgrade) || resourcePlan.editorialValue,
    outreachAngles:
      asStringArray(value.outreachAngles).length > 0
        ? asStringArray(value.outreachAngles)
        : [resourcePlan.outreachRawMaterial.pitchAngle].filter(Boolean),
    searchOperators:
      asStringArray(value.searchOperators).length > 0
        ? asStringArray(value.searchOperators)
        : resourcePlan.outreachRawMaterial.searchOperators,
    campaignName: asString(value.campaignName) || `${resourcePlan.publicName} Outreach`,
    resourcePlan,
  };
}

function normalizeStrategy(value: unknown, topOpportunity: GeneratedOpportunity): CampaignStrategy {
  const strategy = isRecord(value) ? value : {};

  return {
    summary:
      asString(strategy.summary) ||
      `Outreach rund um "${topOpportunity.title}" mit Fokus auf relevante Publisher und Ressourcenseiten.`,
    positioning:
      asString(strategy.positioning) ||
      topOpportunity.recommendedAssetUpgrade ||
      "Als hilfreiche, konkrete Ressource positionieren.",
    recommendedMethods:
      asStringArray(strategy.recommendedMethods).length > 0
        ? asStringArray(strategy.recommendedMethods)
        : ["resource_page", "expert_quote", "resource_promotion"],
    searchOperators:
      asStringArray(strategy.searchOperators).length > 0
        ? asStringArray(strategy.searchOperators)
        : topOpportunity.searchOperators,
    risks: asStringArray(strategy.risks),
    nextActions:
      asStringArray(strategy.nextActions).length > 0
        ? asStringArray(strategy.nextActions)
        : [
            "Asset-Upgrade finalisieren",
            "Prospect-Recherche mit den Suchoperatoren starten",
            "Outreach-Sequenz für die wichtigsten Zielgruppen generieren",
          ],
  };
}

function normalizeGeneratedIntelligence(
  value: unknown,
  context: IntelligenceContext,
  sitemap: SitemapDiscovery
): GeneratedIntelligence {
  if (!isRecord(value)) {
    throw new Error("Generated intelligence JSON must be an object");
  }

  const opportunities = Array.isArray(value.opportunities)
    ? value.opportunities
        .filter(isRecord)
        .map(normalizeOpportunity)
        .filter((item): item is GeneratedOpportunity => Boolean(item))
        .sort((a, b) => b.score - a.score)
    : [];

  const normalizedOpportunities =
    opportunities.length > 0 ? opportunities : [fallbackOpportunity(context)];

  const topOpportunity = normalizedOpportunities[0];
  const campaign = isRecord(value.recommendedCampaign) ? value.recommendedCampaign : {};

  const recommendedCampaign: RecommendedCampaign = {
    name:
      asString(campaign.name) ||
      topOpportunity.campaignName ||
      "KI Outreach Kampagne",
    targetDomain: asString(campaign.targetDomain) || getProjectOrigin(context.project),
    goals:
      asString(campaign.goals) ||
      "Relevante Erwähnungen, Backlinks, Presse- und Outreach-Chancen aus vorhandenem Content gewinnen.",
    strategy: normalizeStrategy(campaign.strategy, topOpportunity),
  };

  const sourceCoverage = isRecord(value.sourceCoverage) ? value.sourceCoverage : {};

  return {
    summary:
      asString(value.summary) ||
      `Beste aktuelle Chance: ${topOpportunity.title}.`,
    sourceCoverage: {
      ...sourceCoverage,
      observedCounts: {
        crawlPages: context.crawlPages?.length ?? 0,
        articles: context.articles?.length ?? 0,
        briefs: context.briefs?.length ?? 0,
        htmlExports: context.htmlExports?.length ?? 0,
        contentAssets: context.contentAssets?.length ?? 0,
        dashboardPages: context.dashboardPages?.length ?? 0,
        sitemapUrls: sitemap.urls.length,
      },
      sitemapErrors: sitemap.errors,
    },
    opportunities: normalizedOpportunities,
    recommendedCampaign,
  };
}

function getValidTargetArticleIds(
  opportunities: GeneratedOpportunity[],
  context: IntelligenceContext
): string[] | undefined {
  const validIds = new Set(
    (context.articles ?? [])
      .map((article) => article.id)
      .filter((id): id is string => Boolean(id))
  );

  const ids = opportunities
    .flatMap((opportunity) => [
      opportunity.targetArticleId,
      opportunity.sourceKind === "article" ? opportunity.sourceId : undefined,
    ])
    .filter((id): id is string => Boolean(id) && validIds.has(id));

  return ids.length > 0 ? Array.from(new Set(ids)).slice(0, 3) : undefined;
}

function extractCompetitors(brandProfile: Record<string, unknown> | null | undefined): string[] {
  const competitors = brandProfile?.competitors;
  if (!Array.isArray(competitors)) return [];

  return competitors
    .map((competitor) => {
      if (typeof competitor === "string") return competitor;
      if (!isRecord(competitor)) return undefined;
      return (
        asString(competitor.domain) ||
        asString(competitor.url) ||
        asString(competitor.name)
      );
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function formatPromptContext(
  context: IntelligenceContext,
  sitemap: SitemapDiscovery
): string {
  return `Projekt- und Content-Kontext:
${safeStringify(context, 62000)}

Verfügbare Ressourcenformate:
${RESOURCE_FORMATS.map((format) => `- ${format}`).join("\n")}

Bewertungslogik:
- Wähle pro Idee ein Hauptformat und zwei plausible Alternativen.
- Bewerte Leser-Nutzen, Redaktions-Nutzen, Linkgrund, Glaubwürdigkeit, Aufwand, Evergreen-Faktor, DACH-Tauglichkeit und Outreach-Fit.
- Plane mindestens zwei neue Ressourcen mit sourceKind "new_asset".
- Öffentliche Namen und Pitches dürfen nicht Linkbait, Linkmagnet oder Link-Magnet enthalten.

Live-Sitemap-Discovery:
${safeStringify(sitemap, 14000)}

Wichtig:
- Wenn ein vorhandener Artikel geeignet ist, nutze dessen id als targetArticleId.
- Wenn eine gecrawlte Seite, ein Brief oder Asset besser ist, erkläre das konkrete Upgrade.
- Erstelle eine Kampagne, die sofort als Outreach-Ausgangspunkt taugt.
- Nutze alle Daten, nicht nur manuelle CRM-Felder.`;
}

export const outreachIntelligence = inngest.createFunction(
  {
    id: "outreach-intelligence",
    name: "Outreach Intelligence",
    concurrency: {
      limit: 2,
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "outreach/intelligence" },
  async ({ event, step }) => {
    const { projectId, userId, workspaceId, analysisId: incomingAnalysisId } =
      event.data as OutreachIntelligenceEventData;
    const workerSecret = getWorkerSecret();
    const inngestEventId = event.id || `outreach-intelligence-${Date.now()}`;
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let analysisId: string | undefined = incomingAnalysisId;

    try {
      await step.run("check-credits", async () => {
        const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
          workspaceId,
          agentId: AGENT_ID,
          requiredCredits: CREDITS_REQUIRED,
        });

        if (!result.success) {
          throw new Error(result.error || "Credit check failed");
        }
      });

      await step.run("create-job-record", async () => {
        await convex.action(api.agents.actions.createAgentJob, {
          inngestEventId,
          userId,
          workspaceId,
          projectId,
          agentId: AGENT_ID,
          eventType: "outreach/intelligence",
          inputData: { projectId },
          creditsReserved: CREDITS_REQUIRED,
        });
      });

      analysisId = (await step.run("prepare-analysis-record", async () => {
        if (incomingAnalysisId) {
          await convex.action(
            api.agents.outreachIntelligenceActions.markRunning,
            {
              analysisId: incomingAnalysisId,
              workerSecret,
            }
          );

          return incomingAnalysisId;
        }

        return await convex.action(
          api.agents.outreachIntelligenceActions.createRunning,
          {
            projectId,
            workerSecret,
          }
        );
      })) as string;

      const context = (await step.run("fetch-project-context", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "running",
          currentStep: "Projekt- und Content-Kontext laden",
          progress: 15,
        });

        const result = (await convex.action(
          api.agents.outreachIntelligenceActions.getContext,
          {
            projectId,
            workerSecret,
          }
        )) as IntelligenceContext | null;

        if (!result?.project) {
          throw new Error(`Project context not found: ${projectId}`);
        }

        return result;
      })) as IntelligenceContext;

      const sitemap = (await step.run("discover-sitemap", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          currentStep: "Sitemap und Website-Struktur lesen",
          progress: 30,
        });

        return await discoverSitemap(getProjectOrigin(context.project));
      })) as SitemapDiscovery;

      const generated = (await step.run("generate-outreach-intelligence", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          currentStep: "Ressourcen-Chancen und Kampagne generieren",
          progress: 50,
        });

        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 6500,
          system: SYSTEM_PROMPT,
          tools: [OUTREACH_INTELLIGENCE_TOOL],
          tool_choice: {
            type: "tool",
            name: OUTREACH_INTELLIGENCE_TOOL_NAME,
          },
          messages: [
            {
              role: "user",
              content: formatPromptContext(context, sitemap),
            },
          ],
        });

        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;

        return normalizeGeneratedIntelligence(
          extractToolInput(response.content, OUTREACH_INTELLIGENCE_TOOL_NAME),
          context,
          sitemap
        );
      })) as GeneratedIntelligence;

      const createdCampaignId = (await step.run("create-generated-campaign", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          currentStep: "Kampagne aus KI-Analyse anlegen",
          progress: 78,
        });

        const targetArticleIds = getValidTargetArticleIds(
          generated.opportunities,
          context
        );

        return await convex.action(
          api.agents.outreachIntelligenceActions.createGeneratedCampaign,
          {
            projectId,
            name: generated.recommendedCampaign.name,
            campaignType: "linkbuilding",
            targetDomain: generated.recommendedCampaign.targetDomain,
            targetArticleIds,
            competitors: extractCompetitors(context.brandProfile),
            goalTargetsJson: {
              source: AGENT_ID,
              goals: generated.recommendedCampaign.goals,
              topOpportunity: generated.opportunities[0],
              resourcePlan: generated.opportunities[0]?.resourcePlan,
            },
            strategyJson: {
              ...generated.recommendedCampaign.strategy,
              intelligenceSummary: generated.summary,
              sourceCoverage: generated.sourceCoverage,
              opportunities: generated.opportunities,
              resourcePlans: generated.opportunities.map(
                (opportunity) => opportunity.resourcePlan
              ),
            },
            status: "ready",
            workerSecret,
          }
        );
      })) as string;

      await step.run("save-analysis", async () => {
        await convex.action(api.agents.outreachIntelligenceActions.saveCompleted, {
          analysisId,
          summary: generated.summary,
          sourceCoverageJson: generated.sourceCoverage,
          opportunitiesJson: generated.opportunities,
          recommendedCampaignJson: generated.recommendedCampaign,
          createdCampaignId,
          workerSecret,
        });
      });

      const durationMs = Date.now() - startTime;

      await step.run("log-usage", async () => {
        await convex.action(api.agents.actions.logUsage, {
          userId,
          workspaceId,
          projectId,
          agentId: AGENT_ID,
          jobId: inngestEventId,
          creditsUsed: CREDITS_REQUIRED,
          inputTokens,
          outputTokens,
          status: "completed",
          durationMs,
        });

        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "completed",
          progress: 100,
          currentStep: "Done",
          creditsUsed: CREDITS_REQUIRED,
          result: {
            analysisId,
            campaignId: createdCampaignId,
            opportunities: generated.opportunities.length,
          },
        });
      });

      return {
        success: true,
        analysisId,
        campaignId: createdCampaignId,
        opportunities: generated.opportunities.length,
        creditsUsed: CREDITS_REQUIRED,
        durationMs,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown outreach intelligence error";

      await step.run("mark-failed", async () => {
        if (analysisId) {
          await convex.action(api.agents.outreachIntelligenceActions.saveFailed, {
            analysisId,
            errorMessage,
            workerSecret,
          });
        }

        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "failed",
          currentStep: "Failed",
          progress: 100,
          errorMessage,
        });
      });

      throw error;
    }
  }
);
