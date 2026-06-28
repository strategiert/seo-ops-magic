export const RESOURCE_FORMATS = [
  "Ratgeber / Broschüre",
  "Checkliste",
  "Kommentierte Linkliste",
  "Ressourcenliste",
  "Ranking / Award",
  "Vergleichstest",
  "Testbericht / Review",
  "Erfahrungsbericht",
  "Pro-und-Kontra-Übersicht",
  "Anleitung / Schritt-für-Schritt-Guide",
  "FAQ",
  "Lexikon / Glossar",
  "Experteninterview",
  "Gruppeninterview / Expert Roundup",
  "Analyse / Umfrage",
  "Report / Whitepaper",
  "Studie / Datenauswertung",
  "Kostenloses Tool",
  "Rechner / Kalkulator",
  "Widget / Plugin / Datenbank",
  "Interaktive Grafik / Diagramm",
  "Timeline / Karte / Visualisierung",
  "PDF zum Ausdrucken",
  "Notfallkarte / Spickzettel",
  "Comic / visuelle Erklärung",
  "Journalisten-Seite / Presse-Ressource",
  "News / bemerkenswerte Meldung",
  "anderes Format",
] as const;

export type ResourcePlanFormatScore = {
  readerBenefit: number;
  editorialBenefit: number;
  linkReason: number;
  credibility: number;
  effort: number;
  evergreen: number;
  dachFit: number;
  outreachFit: number;
  total: number;
};

export type ResourcePlanOutreachRawMaterial = {
  whyThisSite: string;
  placementIdea: string;
  pitchAngle: string;
  searchOperators: string[];
};

export type ResourcePlan = {
  title: string;
  publicName: string;
  resourceType: string;
  alternativeTypes: string[];
  readerAudience: string;
  linkAudiences: string[];
  readerProblem: string;
  editorialValue: string;
  linkReason: string;
  decommercialization: string[];
  credibilityPlan: string[];
  formatScore: ResourcePlanFormatScore;
  mvpScope: string[];
  claudeCodeBrief: string;
  outreachRawMaterial: ResourcePlanOutreachRawMaterial;
};

const forbiddenPublicTerms = [
  /\blinkbait\b/gi,
  /\blink bait\b/gi,
  /\blinkmagnet\b/gi,
  /\blink-magnet\b/gi,
];

const defaultFormatScore: ResourcePlanFormatScore = {
  readerBenefit: 0.5,
  editorialBenefit: 0.5,
  linkReason: 0.5,
  credibility: 0.5,
  effort: 0.5,
  evergreen: 0.5,
  dachFit: 0.5,
  outreachFit: 0.5,
  total: 0.5,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampScore(value: unknown): number {
  const score = asNumber(value);
  if (score === undefined) return 0.5;
  if (score > 1) return Math.max(0, Math.min(score / 100, 1));
  return Math.max(0, Math.min(score, 1));
}

function sanitizePublicText(value: string): string {
  return forbiddenPublicTerms
    .reduce((label, term) => label.replace(term, "Ressource"), value)
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePublicTextArray(values: string[]): string[] {
  return values.map(sanitizePublicText);
}

export function hasForbiddenPublicTerm(value: string): boolean {
  return forbiddenPublicTerms.some((term) => {
    term.lastIndex = 0;
    return term.test(value);
  });
}

function normalizeFormatScore(value: unknown): ResourcePlanFormatScore {
  const score = isRecord(value) ? value : {};

  return {
    readerBenefit: clampScore(score.readerBenefit),
    editorialBenefit: clampScore(score.editorialBenefit),
    linkReason: clampScore(score.linkReason),
    credibility: clampScore(score.credibility),
    effort: clampScore(score.effort),
    evergreen: clampScore(score.evergreen),
    dachFit: clampScore(score.dachFit),
    outreachFit: clampScore(score.outreachFit),
    total: clampScore(score.total),
  };
}

function normalizeOutreachRawMaterial(
  value: unknown
): ResourcePlanOutreachRawMaterial {
  const material = isRecord(value) ? value : {};

  return {
    whyThisSite: sanitizePublicText(asString(material.whyThisSite) || ""),
    placementIdea: sanitizePublicText(asString(material.placementIdea) || ""),
    pitchAngle: sanitizePublicText(asString(material.pitchAngle) || ""),
    searchOperators: sanitizePublicTextArray(
      asStringArray(material.searchOperators)
    ),
  };
}

export function normalizeResourcePlan(
  value: unknown,
  fallbackTitle: string
): ResourcePlan {
  const plan = isRecord(value) ? value : {};
  const title = sanitizePublicText(asString(plan.title) || fallbackTitle);
  const publicName = sanitizePublicText(
    asString(plan.publicName) || asString(plan.title) || fallbackTitle
  );

  return {
    title,
    publicName,
    resourceType: sanitizePublicText(asString(plan.resourceType) || RESOURCE_FORMATS[0]),
    alternativeTypes: sanitizePublicTextArray(
      asStringArray(plan.alternativeTypes).slice(0, 3)
    ),
    readerAudience: sanitizePublicText(asString(plan.readerAudience) || ""),
    linkAudiences: sanitizePublicTextArray(asStringArray(plan.linkAudiences)),
    readerProblem: sanitizePublicText(asString(plan.readerProblem) || ""),
    editorialValue: sanitizePublicText(asString(plan.editorialValue) || ""),
    linkReason: sanitizePublicText(asString(plan.linkReason) || ""),
    decommercialization: sanitizePublicTextArray(
      asStringArray(plan.decommercialization)
    ),
    credibilityPlan: sanitizePublicTextArray(asStringArray(plan.credibilityPlan)),
    formatScore: {
      ...defaultFormatScore,
      ...normalizeFormatScore(plan.formatScore),
    },
    mvpScope: sanitizePublicTextArray(asStringArray(plan.mvpScope)),
    claudeCodeBrief: sanitizePublicText(asString(plan.claudeCodeBrief) || ""),
    outreachRawMaterial: normalizeOutreachRawMaterial(plan.outreachRawMaterial),
  };
}

function renderList(items: string[]): string {
  return items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : "- Keine Angabe";
}

export function formatResourcePlanBrief(plan: ResourcePlan): string {
  return [
    `# ${plan.publicName}`,
    "",
    "## Ressourcen-Konzept",
    `Format: ${plan.resourceType}`,
    `Alternativen: ${
      plan.alternativeTypes.length > 0
        ? plan.alternativeTypes.join(", ")
        : "Keine"
    }`,
    `Leserzielgruppe: ${plan.readerAudience || "Keine Angabe"}`,
    `Leserproblem: ${plan.readerProblem || "Keine Angabe"}`,
    `Redaktioneller Wert: ${plan.editorialValue || "Keine Angabe"}`,
    `Linkgrund: ${plan.linkReason || "Keine Angabe"}`,
    "",
    "## Linkzielgruppen",
    renderList(plan.linkAudiences),
    "",
    "## Entkommerzialisierung",
    renderList(plan.decommercialization),
    "",
    "## Glaubwürdigkeitsplan",
    renderList(plan.credibilityPlan),
    "",
    "## MVP-Scope",
    renderList(plan.mvpScope),
    "",
    "## Claude-Code-Build-Brief",
    plan.claudeCodeBrief || "Kein Build-Brief vorhanden.",
    "",
    "## Outreach-Rohmaterial",
    `Warum diese Zielseite: ${plan.outreachRawMaterial.whyThisSite || "Keine Angabe"}`,
    `Platzierungsidee: ${plan.outreachRawMaterial.placementIdea || "Keine Angabe"}`,
    `Pitch-Winkel: ${plan.outreachRawMaterial.pitchAngle || "Keine Angabe"}`,
    "",
    "Suchoperatoren:",
    renderList(plan.outreachRawMaterial.searchOperators),
  ].join("\n");
}
