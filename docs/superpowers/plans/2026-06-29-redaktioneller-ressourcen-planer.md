# Redaktioneller Ressourcen-Planer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Outreach Intelligence so it produces editorially link-worthy resource plans with format scoring, Claude-Code build briefs, and outreach raw material.

**Architecture:** Keep the first implementation inside the existing Outreach Intelligence flow and persist the richer plans in `outreachAnalyses.opportunitiesJson`. Add a pure shared resource-plan model/normalizer for server and UI usage, extend the Inngest Anthropic tool contract to generate `resourcePlan` objects, and replace the current opportunity list with resource-plan cards plus a detail dialog.

**Tech Stack:** React 18, Vite, TypeScript, shadcn/ui, Radix Dialog/ScrollArea/Separator, Convex, Inngest, Anthropic Tool Use, Node `assert` script tests, Vercel.

---

## Scope

This plan implements the first product slice from `docs/superpowers/specs/2026-06-29-redaktioneller-ressourcen-planer-design.md`.

Included:

- Shared resource-plan taxonomy, types, normalization, and clipboard formatting.
- Extended Outreach Intelligence prompt, tool schema, generated opportunity type, fallback, and normalizer.
- UI that presents generated opportunities as editorial resource plans.
- Detail dialog with concept, scoring matrix, decommercialization, credibility plan, build brief, and outreach raw material.
- Tests for normalization, Anthropic Tool-Use extraction compatibility, German copy, and source contract.

Excluded:

- New Convex `resourcePlans` table.
- Automatic build execution.
- WordPress publishing.
- Prospect scraping.
- Email sending and warm-up.

## File Map

- Create `src/lib/outreach/resourcePlans.ts`  
  Pure TypeScript model for resource-plan formats, field normalization, forbidden public label detection, score clamping, and clipboard text generation.

- Create `scripts/tests/resource-plan-normalization.test.ts`  
  Script test for taxonomy coverage, normalization, score clamping, forbidden public terms, and generated clipboard text.

- Create `scripts/tests/outreach-resource-plan-contract.test.ts`  
  Script test that verifies the Outreach Intelligence agent contains the required resource-plan prompt and tool contract fields.

- Modify `scripts/tests/anthropic-tool-input.test.ts`  
  Extend the fixture so the existing Tool-Use extraction test includes a nested `resourcePlan`.

- Modify `src/inngest/functions/growth/outreachIntelligence.ts`  
  Import the shared normalizer, add the resource taxonomy to the prompt context, extend the Anthropic tool schema, normalize nested resource plans, update fallback output, and make campaign strategy use the planned resource.

- Create `src/components/outreach/ResourcePlanCard.tsx`  
  Compact repeated item component for one generated resource idea.

- Create `src/components/outreach/ResourcePlanDetailDialog.tsx`  
  Dialog component for reviewing and copying the plan, build brief, and outreach raw material.

- Modify `src/components/outreach/OutreachIntelligencePanel.tsx`  
  Import resource-plan helpers/components, normalize each opportunity with `resourcePlan`, update empty/running copy, render resource cards, and control the detail dialog.

- Modify `scripts/tests/german-umlauts.test.ts`  
  Add new outreach/resource files to the umlaut scan.

---

### Task 1: Add Shared Resource-Plan Model

**Files:**
- Create: `scripts/tests/resource-plan-normalization.test.ts`
- Create: `src/lib/outreach/resourcePlans.ts`

- [ ] **Step 1: Write the failing normalization test**

Create `scripts/tests/resource-plan-normalization.test.ts` with this content:

```ts
import assert from "node:assert/strict";
import {
  RESOURCE_FORMATS,
  formatResourcePlanBrief,
  hasForbiddenPublicTerm,
  normalizeResourcePlan,
} from "../../src/lib/outreach/resourcePlans";

const requiredFormats = [
  "Ratgeber / Broschüre",
  "Checkliste",
  "Kommentierte Linkliste",
  "Ressourcenliste",
  "Ranking / Award",
  "Vergleichstest",
  "Experteninterview",
  "Gruppeninterview / Expert Roundup",
  "Analyse / Umfrage",
  "Report / Whitepaper",
  "Kostenloses Tool",
  "Rechner / Kalkulator",
  "Journalisten-Seite / Presse-Ressource",
  "Notfallkarte / Spickzettel",
];

for (const format of requiredFormats) {
  assert.ok(
    RESOURCE_FORMATS.includes(format),
    `Missing resource format: ${format}`
  );
}

const plan = normalizeResourcePlan(
  {
    title: "Linkbait Eltern-Notfallkarte",
    publicName: "Linkbait Eltern-Notfallkarte",
    resourceType: "Notfallkarte / Spickzettel",
    alternativeTypes: ["Ratgeber / Broschüre", "PDF zum Ausdrucken"],
    readerAudience: "Eltern von Kindern im Kita- und Grundschulalter",
    linkAudiences: ["Elternportale", "Pädagogik-Websites"],
    readerProblem: "Eltern wissen in Eskalationsmomenten nicht, was sie sagen sollen.",
    editorialValue:
      "Ergänzt bestehende Artikel über Wutanfälle um ein direkt nutzbares Hilfsmittel.",
    linkReason:
      "Kostenlose, praktische Weiterführung für Leser, die nach konkreten Formulierungen suchen.",
    decommercialization: [
      "Keine Produktwerbung",
      "Kein aggressives Leadgate",
    ],
    credibilityPlan: ["Quellen zu Co-Regulation", "Pädagogischer Review"],
    formatScore: {
      readerBenefit: 92,
      editorialBenefit: 0.86,
      linkReason: 0.88,
      credibility: 0.72,
      effort: 0.34,
      evergreen: 0.91,
      dachFit: 0.88,
      outreachFit: 0.84,
      total: 85,
    },
    mvpScope: ["Ratgeberseite", "druckbares PDF", "5 konkrete Sätze"],
    claudeCodeBrief: "Baue eine entkommerzialisierte Ressourcen-Seite.",
    outreachRawMaterial: {
      whyThisSite: "Die Zielseite behandelt bereits Wutanfälle bei Kindern.",
      placementIdea:
        "Als weiterführende Information im Abschnitt zu akuten Situationen.",
      pitchAngle: "kostenlose Notfallkarte als praktische Ergänzung für Eltern",
      searchOperators: [
        "Wutanfall Kind Eltern Tipps",
        "site:.de Wutanfälle Kinder Eltern Ratgeber",
      ],
    },
  },
  "Eltern-Notfallkarte"
);

assert.equal(plan.publicName, "Ressource Eltern-Notfallkarte");
assert.equal(hasForbiddenPublicTerm(plan.publicName), false);
assert.equal(plan.resourceType, "Notfallkarte / Spickzettel");
assert.deepEqual(plan.alternativeTypes, [
  "Ratgeber / Broschüre",
  "PDF zum Ausdrucken",
]);
assert.equal(plan.formatScore.readerBenefit, 0.92);
assert.equal(plan.formatScore.total, 0.85);
assert.deepEqual(plan.outreachRawMaterial.searchOperators, [
  "Wutanfall Kind Eltern Tipps",
  "site:.de Wutanfälle Kinder Eltern Ratgeber",
]);

const fallbackPlan = normalizeResourcePlan({}, "Fallback-Ratgeber");
assert.equal(fallbackPlan.publicName, "Fallback-Ratgeber");
assert.equal(fallbackPlan.resourceType, "Ratgeber / Broschüre");
assert.equal(fallbackPlan.formatScore.total, 0.5);

const brief = formatResourcePlanBrief(plan);
assert.match(brief, /Eltern-Notfallkarte/);
assert.match(brief, /Claude-Code-Build-Brief/);
assert.match(brief, /Outreach-Rohmaterial/);
assert.doesNotMatch(brief, /Linkbait/);

console.log("resource-plan-normalization tests passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx --yes tsx scripts/tests/resource-plan-normalization.test.ts
```

Expected: FAIL with a module resolution error for `../../src/lib/outreach/resourcePlans`.

- [ ] **Step 3: Create the shared model and normalizer**

Create `src/lib/outreach/resourcePlans.ts` with this content:

```ts
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

function sanitizePublicLabel(value: string): string {
  return forbiddenPublicTerms
    .reduce((label, term) => label.replace(term, "Ressource"), value)
    .replace(/\s+/g, " ")
    .trim();
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
    whyThisSite: asString(material.whyThisSite) || "",
    placementIdea: asString(material.placementIdea) || "",
    pitchAngle: asString(material.pitchAngle) || "",
    searchOperators: asStringArray(material.searchOperators),
  };
}

export function normalizeResourcePlan(
  value: unknown,
  fallbackTitle: string
): ResourcePlan {
  const plan = isRecord(value) ? value : {};
  const title = asString(plan.title) || fallbackTitle;
  const publicName = sanitizePublicLabel(
    asString(plan.publicName) || asString(plan.title) || fallbackTitle
  );

  return {
    title,
    publicName,
    resourceType: asString(plan.resourceType) || RESOURCE_FORMATS[0],
    alternativeTypes: asStringArray(plan.alternativeTypes).slice(0, 3),
    readerAudience: asString(plan.readerAudience) || "",
    linkAudiences: asStringArray(plan.linkAudiences),
    readerProblem: asString(plan.readerProblem) || "",
    editorialValue: asString(plan.editorialValue) || "",
    linkReason: asString(plan.linkReason) || "",
    decommercialization: asStringArray(plan.decommercialization),
    credibilityPlan: asStringArray(plan.credibilityPlan),
    formatScore: {
      ...defaultFormatScore,
      ...normalizeFormatScore(plan.formatScore),
    },
    mvpScope: asStringArray(plan.mvpScope),
    claudeCodeBrief: asString(plan.claudeCodeBrief) || "",
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
```

- [ ] **Step 4: Run the normalization test to verify it passes**

Run:

```bash
npx --yes tsx scripts/tests/resource-plan-normalization.test.ts
```

Expected: PASS with `resource-plan-normalization tests passed`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/outreach/resourcePlans.ts scripts/tests/resource-plan-normalization.test.ts
git commit -m "feat: add resource plan model"
```

Expected: commit succeeds.

---

### Task 2: Extend Outreach Intelligence Agent Contract

**Files:**
- Create: `scripts/tests/outreach-resource-plan-contract.test.ts`
- Modify: `scripts/tests/anthropic-tool-input.test.ts`
- Modify: `src/inngest/functions/growth/outreachIntelligence.ts`

- [ ] **Step 1: Write the failing contract test**

Create `scripts/tests/outreach-resource-plan-contract.test.ts` with this content:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/inngest/functions/growth/outreachIntelligence.ts",
  "utf8"
);

const requiredFields = [
  "resourcePlan",
  "publicName",
  "resourceType",
  "alternativeTypes",
  "readerAudience",
  "linkAudiences",
  "readerProblem",
  "editorialValue",
  "linkReason",
  "decommercialization",
  "credibilityPlan",
  "formatScore",
  "mvpScope",
  "claudeCodeBrief",
  "outreachRawMaterial",
];

for (const field of requiredFields) {
  assert.match(source, new RegExp(field), `Missing field in agent contract: ${field}`);
}

assert.match(
  source,
  /mindestens zwei `new_asset` Ideen/,
  "Agent prompt must require at least two new_asset resource ideas"
);

assert.match(
  source,
  /Nenne die Ressource nie Linkbait/,
  "Agent prompt must forbid public Linkbait wording"
);

assert.match(
  source,
  /RESOURCE_FORMATS/,
  "Agent must pass the resource format taxonomy into the prompt context"
);

console.log("outreach-resource-plan-contract tests passed");
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
npx --yes tsx scripts/tests/outreach-resource-plan-contract.test.ts
```

Expected: FAIL with `Missing field in agent contract: resourcePlan`.

- [ ] **Step 3: Extend the Anthropic Tool-Use extraction fixture**

Modify `scripts/tests/anthropic-tool-input.test.ts` so the single opportunity in `toolInput` includes a nested `resourcePlan`:

```ts
  opportunities: [
    {
      title: "Ratgeber für Rückenwindeltern",
      score: 0.87,
      sourceKind: "new_asset",
      resourcePlan: {
        publicName: "Eltern-Notfallkarte",
        resourceType: "Notfallkarte / Spickzettel",
        alternativeTypes: ["Ratgeber / Broschüre", "PDF zum Ausdrucken"],
        readerAudience: "Eltern von Kindern im Kita- und Grundschulalter",
        linkAudiences: ["Elternportale", "Pädagogik-Websites"],
        readerProblem:
          "Eltern wissen in akuten Eskalationsmomenten nicht, was sie sagen sollen.",
        editorialValue:
          "Ergänzt bestehende Ratgeber um ein direkt nutzbares Hilfsmittel.",
        linkReason:
          "Kostenlose, praktische Weiterführung für Leser in akuten Situationen.",
        decommercialization: ["Keine Produktwerbung", "Keine aggressive Lead-Mechanik"],
        credibilityPlan: ["Pädagogische Quellen sichtbar machen"],
        formatScore: {
          readerBenefit: 0.92,
          editorialBenefit: 0.86,
          linkReason: 0.88,
          credibility: 0.72,
          effort: 0.34,
          evergreen: 0.91,
          dachFit: 0.88,
          outreachFit: 0.84,
          total: 0.85,
        },
        mvpScope: ["Ratgeberseite", "druckbares PDF"],
        claudeCodeBrief: "Baue eine entkommerzialisierte Ressourcen-Seite.",
        outreachRawMaterial: {
          whyThisSite: "Die Zielseite behandelt Wutanfälle bei Kindern.",
          placementIdea: "Weiterführende Information im Abschnitt zu akuten Situationen.",
          pitchAngle: "kostenlose Notfallkarte für Eltern",
          searchOperators: ["Wutanfall Kind Eltern Ratgeber"],
        },
      },
    },
  ],
```

- [ ] **Step 4: Modify imports in the agent**

In `src/inngest/functions/growth/outreachIntelligence.ts`, add these imports near the existing imports:

```ts
import {
  RESOURCE_FORMATS,
  normalizeResourcePlan,
} from "../../../lib/outreach/resourcePlans.js";
import type { ResourcePlan } from "../../../lib/outreach/resourcePlans.js";
```

- [ ] **Step 5: Extend the generated opportunity type**

Replace the current `GeneratedOpportunity` type with:

```ts
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
```

- [ ] **Step 6: Add resource-plan schema constants**

Add these constants before `OUTREACH_INTELLIGENCE_TOOL`:

```ts
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
```

- [ ] **Step 7: Add `resourcePlan` to the opportunity tool schema**

Inside the `opportunities.items.properties` object in `OUTREACH_INTELLIGENCE_TOOL`, add:

```ts
            resourcePlan: RESOURCE_PLAN_TOOL_SCHEMA,
```

Then change the `required` array for each opportunity from:

```ts
          required: ["title"],
```

to:

```ts
          required: ["title", "resourcePlan"],
```

- [ ] **Step 8: Update the system prompt**

Replace the current `SYSTEM_PROMPT` body with a version that keeps the existing agent role and adds the resource-planner rules below. The prompt must contain these exact sentences so the contract test passes:

```ts
const SYSTEM_PROMPT = `Du bist der Outreach Intelligence Agent für SEO Ops Magic.

Deine Aufgabe: Verstehe zuerst die Marke, Website, vorhandenen Content und Sitemap. Danach planst du redaktionell verlinkbare Ressourcen, die fremde Websites ihren Lesern sinnvoll empfehlen können. Das Tool ist offen für SEO, PR, Sales und Partnerships; technisch ist es Outreach, die Positionierung unterscheidet sich je nach Ziel.

Arbeite praktisch und kampagnenfähig:
- Bewerte vorhandene Artikel, gecrawlte Seiten, HTML-Exports, Briefs, Assets, Sitemap-URLs und Brand-Daten.
- Denke zuerst aus Sicht fremder Leser, Redaktionen, Vereine, Pädagogen, Portale, Fachblogs, Webmaster und Journalisten.
- Linkerati sind nicht zwingend Kunden. Baue Ressourcen für Menschen, die verlinken können oder sollen.
- Plane verlinkbare Ressourcen wie Ratgeber, Broschüren, Checklisten, Experteninterviews, Gruppeninterviews, Analysen, Umfragen, Whitepaper, Rechner, Tools, Vorlagen, Glossare, Presse-Ressourcen, Notfallkarten oder interaktive Visualisierungen.
- Nenne die Ressource nie Linkbait, Linkmagnet oder Link-Magnet in publicName, claudeCodeBrief oder Outreach-Rohmaterial.
- Intern darfst du Linkbait-Potenzial bewerten, aber extern nutzt du Begriffe wie Ressource, Ratgeber, Checkliste, Tool, Broschüre, PDF, Studie, Hilfsmittel oder weiterführende Information.
- Prüfe die entkommerzialisierte Zone: keine Salesbotschaft, kein Warenkorb, keine aggressive Lead-Mechanik, keine Produktwerbung als Hauptzweck.
- DACH-Linkaufbau braucht Tiefe, Seriosität, Quellen, Experten, echte Nützlichkeit und klare Leserhilfe.
- Wenn vorhandener Content schwach ist, plane neue Assets. Erzeuge mindestens zwei \`new_asset\` Ideen.
- Jede Opportunity braucht ein resourcePlan Objekt mit Formatentscheidung, Alternativen, Linkzielgruppen, Leserproblem, redaktionellem Wert, Linkgrund, Glaubwürdigkeitsplan, MVP-Scope, Claude-Code-Build-Brief und Outreach-Rohmaterial.
- Gib konkrete Platzierungsideen auf fremden Seiten an, z.B. "als weiterführende Information im Abschnitt X".
- Füll die Kampagne so weit wie möglich selbst aus. Keine Rückfragen, außer Daten fehlen komplett.
- Schreibe auf Deutsch, klar, konkret und handlungsorientiert.
- Vermeide rechtliche Belehrungen. Erwähne Risiken nur operativ, z.B. Relevanz, Spam-Signale, schwache Linkbarkeit.

Antworte ausschließlich über das bereitgestellte Tool.`;
```

- [ ] **Step 9: Add the taxonomy to prompt context**

In `formatPromptContext`, add the format taxonomy between the project context and sitemap sections:

```ts
Verfügbare Ressourcenformate:
${RESOURCE_FORMATS.map((format) => `- ${format}`).join("\n")}

Bewertungslogik:
- Wähle pro Idee ein Hauptformat und zwei plausible Alternativen.
- Bewerte Leser-Nutzen, Redaktions-Nutzen, Linkgrund, Glaubwürdigkeit, Aufwand, Evergreen-Faktor, DACH-Tauglichkeit und Outreach-Fit.
- Plane mindestens zwei neue Ressourcen mit sourceKind "new_asset".
- Öffentliche Namen und Pitches dürfen nicht Linkbait, Linkmagnet oder Link-Magnet enthalten.
```

- [ ] **Step 10: Extend `fallbackOpportunity`**

Inside the object returned by `fallbackOpportunity`, add this `resourcePlan` property after `campaignName`:

```ts
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
```

- [ ] **Step 11: Extend `normalizeOpportunity`**

Inside `normalizeOpportunity`, compute and return the normalized resource plan:

```ts
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
```

- [ ] **Step 12: Update generated campaign strategy payload**

In the `create-generated-campaign` step, add `resourcePlan` to `goalTargetsJson` and make the strategy carry resource plans:

```ts
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
```

- [ ] **Step 13: Run contract and Tool-Use tests**

Run:

```bash
npx --yes tsx scripts/tests/outreach-resource-plan-contract.test.ts
npx --yes tsx scripts/tests/anthropic-tool-input.test.ts
```

Expected:

```text
outreach-resource-plan-contract tests passed
anthropic-tool-input tests passed
```

- [ ] **Step 14: Commit Task 2**

Run:

```bash
git add src/inngest/functions/growth/outreachIntelligence.ts scripts/tests/anthropic-tool-input.test.ts scripts/tests/outreach-resource-plan-contract.test.ts
git commit -m "feat: generate editorial resource plans"
```

Expected: commit succeeds.

---

### Task 3: Add Resource Plan UI Components

**Files:**
- Create: `src/components/outreach/ResourcePlanCard.tsx`
- Create: `src/components/outreach/ResourcePlanDetailDialog.tsx`

- [ ] **Step 1: Create `ResourcePlanCard`**

Create `src/components/outreach/ResourcePlanCard.tsx` with this content:

```tsx
import { ArrowRight, FileText, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResourcePlan } from "@/lib/outreach/resourcePlans";

type ResourcePlanCardProps = {
  title: string;
  score: number;
  effort: string;
  sourceKind: string;
  resourcePlan: ResourcePlan;
  onOpen: () => void;
};

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(score, 1)) * 100)}%`;
}

export function ResourcePlanCard({
  title,
  score,
  effort,
  sourceKind,
  resourcePlan,
  onOpen,
}: ResourcePlanCardProps) {
  return (
    <div className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md">{formatScore(score)}</Badge>
            <Badge variant="outline" className="rounded-md">
              {resourcePlan.resourceType}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {sourceKind}
            </Badge>
            <Badge variant="secondary" className="rounded-md">
              Aufwand: {effort}
            </Badge>
          </div>

          <div>
            <h3 className="font-semibold leading-6">
              {resourcePlan.publicName || title}
            </h3>
            {resourcePlan.editorialValue && (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {resourcePlan.editorialValue}
              </p>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={onOpen} className="shrink-0">
          Plan öffnen
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Leserproblem
          </div>
          <p className="text-sm leading-5">
            {resourcePlan.readerProblem || "Noch kein Leserproblem angegeben."}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Linkzielgruppen
          </div>
          <div className="flex flex-wrap gap-1.5">
            {resourcePlan.linkAudiences.slice(0, 5).map((audience) => (
              <Badge
                key={audience}
                variant="secondary"
                className="rounded-md font-normal"
              >
                {audience}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Linkgrund
          </div>
          <p className="text-sm leading-5">
            {resourcePlan.linkReason || "Noch kein Linkgrund angegeben."}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ResourcePlanDetailDialog`**

Create `src/components/outreach/ResourcePlanDetailDialog.tsx` with this content:

```tsx
import { Clipboard, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  formatResourcePlanBrief,
  type ResourcePlan,
} from "@/lib/outreach/resourcePlans";

type ResourcePlanDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourcePlan: ResourcePlan | null;
};

const scoreLabels: Array<[keyof ResourcePlan["formatScore"], string]> = [
  ["readerBenefit", "Leser-Nutzen"],
  ["editorialBenefit", "Redaktions-Nutzen"],
  ["linkReason", "Linkgrund"],
  ["credibility", "Glaubwürdigkeit"],
  ["effort", "Aufwand"],
  ["evergreen", "Evergreen"],
  ["dachFit", "DACH-Fit"],
  ["outreachFit", "Outreach-Fit"],
  ["total", "Gesamt"],
];

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(score, 1)) * 100)}%`;
}

function ListBlock({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Angabe</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {items.map((item) => (
        <li key={item} className="leading-5">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ResourcePlanDetailDialog({
  open,
  onOpenChange,
  resourcePlan,
}: ResourcePlanDetailDialogProps) {
  const { toast } = useToast();

  if (!resourcePlan) {
    return null;
  }

  const fullBrief = formatResourcePlanBrief(resourcePlan);

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: `${label} wurde in die Zwischenablage kopiert.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <DialogTitle>{resourcePlan.publicName}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-md">
                  {formatScore(resourcePlan.formatScore.total)}
                </Badge>
                <Badge variant="outline" className="rounded-md">
                  {resourcePlan.resourceType}
                </Badge>
                {resourcePlan.alternativeTypes.slice(0, 2).map((type) => (
                  <Badge key={type} variant="secondary" className="rounded-md">
                    Alternative: {type}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => copyText("Ressourcen-Plan", fullBrief)}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Alles kopieren
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(88vh-96px)]">
          <div className="space-y-6 px-6 py-5">
            <section className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Leserzielgruppe
                </p>
                <p className="mt-1 text-sm leading-6">
                  {resourcePlan.readerAudience || "Keine Angabe"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Leserproblem
                </p>
                <p className="mt-1 text-sm leading-6">
                  {resourcePlan.readerProblem || "Keine Angabe"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Redaktioneller Wert
                </p>
                <p className="mt-1 text-sm leading-6">
                  {resourcePlan.editorialValue || "Keine Angabe"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Linkgrund
                </p>
                <p className="mt-1 text-sm leading-6">
                  {resourcePlan.linkReason || "Keine Angabe"}
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="font-medium">Bewertungsmatrix</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {scoreLabels.map(([key, label]) => (
                  <div key={key} className="rounded-md border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">
                      {formatScore(resourcePlan.formatScore[key])}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-medium">Linkzielgruppen</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {resourcePlan.linkAudiences.map((audience) => (
                    <Badge
                      key={audience}
                      variant="secondary"
                      className="rounded-md font-normal"
                    >
                      {audience}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium">MVP-Scope</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.mvpScope} />
                </div>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-medium">Entkommerzialisierung</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.decommercialization} />
                </div>
              </div>
              <div>
                <h3 className="font-medium">Glaubwürdigkeitsplan</h3>
                <div className="mt-2">
                  <ListBlock items={resourcePlan.credibilityPlan} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-medium">Claude-Code-Build-Brief</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyText("Build-Brief", resourcePlan.claudeCodeBrief)
                  }
                >
                  <Clipboard className="mr-2 h-4 w-4" />
                  Kopieren
                </Button>
              </div>
              <Textarea
                value={resourcePlan.claudeCodeBrief}
                readOnly
                className="min-h-[180px] resize-none text-sm"
              />
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Outreach-Rohmaterial</h3>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Warum diese Zielseite
                  </p>
                  <p className="mt-1 leading-5">
                    {resourcePlan.outreachRawMaterial.whyThisSite || "Keine Angabe"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Platzierungsidee
                  </p>
                  <p className="mt-1 leading-5">
                    {resourcePlan.outreachRawMaterial.placementIdea || "Keine Angabe"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Pitch-Winkel
                  </p>
                  <p className="mt-1 leading-5">
                    {resourcePlan.outreachRawMaterial.pitchAngle || "Keine Angabe"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Suchoperatoren
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {resourcePlan.outreachRawMaterial.searchOperators.map((operator) => (
                    <Badge key={operator} variant="outline" className="rounded-md">
                      {operator}
                    </Badge>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Run a targeted lint on the new components**

Run:

```bash
npx eslint src/components/outreach/ResourcePlanCard.tsx src/components/outreach/ResourcePlanDetailDialog.tsx
```

Expected: no lint errors.

- [ ] **Step 4: Commit Task 3**

Run:

```bash
git add src/components/outreach/ResourcePlanCard.tsx src/components/outreach/ResourcePlanDetailDialog.tsx
git commit -m "feat: add resource plan UI components"
```

Expected: commit succeeds.

---

### Task 4: Integrate Resource Plans Into Outreach Intelligence Panel

**Files:**
- Modify: `src/components/outreach/OutreachIntelligencePanel.tsx`

- [ ] **Step 1: Update imports**

In `src/components/outreach/OutreachIntelligencePanel.tsx`, add:

```ts
import {
  normalizeResourcePlan,
  type ResourcePlan,
} from "@/lib/outreach/resourcePlans";
import { ResourcePlanCard } from "@/components/outreach/ResourcePlanCard";
import { ResourcePlanDetailDialog } from "@/components/outreach/ResourcePlanDetailDialog";
```

- [ ] **Step 2: Extend the local opportunity type**

Change `type Opportunity` to:

```ts
type Opportunity = {
  title: string;
  contentType: string;
  sourceKind: string;
  sourceUrl?: string;
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
```

- [ ] **Step 3: Normalize resource plans inside `normalizeOpportunity`**

Inside `normalizeOpportunity`, compute the nested plan after title validation:

```ts
  const resourcePlan = normalizeResourcePlan(
    isRecord(value.resourcePlan) ? value.resourcePlan : value,
    title
  );
```

Then add `resourcePlan` to the returned object and update fallbacks:

```ts
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
```

- [ ] **Step 4: Add selected plan state**

Inside `OutreachIntelligencePanel`, after `isStarting`, add:

```ts
  const [selectedPlan, setSelectedPlan] = useState<ResourcePlan | null>(null);
```

- [ ] **Step 5: Update user-facing copy**

Change the header description from:

```tsx
                  Analysiert Brand-Profil, Crawl, Content, Integrationen und Sitemap
                  und erzeugt daraus eine fertige Outreach-Kampagne.
```

to:

```tsx
                  Analysiert Brand-Profil, Crawl, Content und Sitemap und plant
                  verlinkbare Ressourcen für Redaktionen, Blogs und Webmaster.
```

Change the toast description from:

```ts
          "Der Agent liest Projektkontext, Sitemap und Content und legt danach eine Kampagne an.",
```

to:

```ts
          "Der Agent liest Projektkontext, Sitemap und Content und plant daraus verlinkbare Ressourcen.",
```

Change the running text from:

```tsx
                : "Die KI sammelt Website-Struktur, vorhandene Inhalte und mögliche Linkbait-Assets."}
```

to:

```tsx
                : "Die KI sammelt Website-Struktur, vorhandene Inhalte und mögliche redaktionelle Ressourcen."}
```

Change the empty state text from:

```tsx
                  Linkbait-Potenziale aus vorhandenen Daten findet.
```

to:

```tsx
                  verlinkbare Ressourcen aus vorhandenen Daten und neuen Asset-Ideen plant.
```

- [ ] **Step 6: Replace the old opportunity list with resource-plan cards**

Replace the entire block that starts with:

```tsx
          {opportunities.length > 0 && (
            <div className="divide-y rounded-md border">
```

and ends with the matching closing `</div>` for that `opportunities.slice(0, 4).map(...)` section with:

```tsx
          {opportunities.length > 0 && (
            <div className="divide-y rounded-md border">
              {opportunities.slice(0, 5).map((opportunity, index) => (
                <ResourcePlanCard
                  key={`${opportunity.title}-${index}`}
                  title={opportunity.title}
                  score={opportunity.score}
                  effort={opportunity.effort}
                  sourceKind={opportunity.sourceKind}
                  resourcePlan={opportunity.resourcePlan}
                  onOpen={() => setSelectedPlan(opportunity.resourcePlan)}
                />
              ))}
            </div>
          )}
```

- [ ] **Step 7: Render the detail dialog**

Just before the closing `</section>` of `OutreachIntelligencePanel`, add:

```tsx
      <ResourcePlanDetailDialog
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
        resourcePlan={selectedPlan}
      />
```

- [ ] **Step 8: Run targeted lint**

Run:

```bash
npx eslint src/components/outreach/OutreachIntelligencePanel.tsx src/components/outreach/ResourcePlanCard.tsx src/components/outreach/ResourcePlanDetailDialog.tsx
```

Expected: no lint errors.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add src/components/outreach/OutreachIntelligencePanel.tsx
git commit -m "feat: show editorial resource plans"
```

Expected: commit succeeds.

---

### Task 5: Strengthen German Copy and Public-Label Tests

**Files:**
- Modify: `scripts/tests/german-umlauts.test.ts`
- Modify: `scripts/tests/resource-plan-normalization.test.ts`

- [ ] **Step 1: Add new files to the umlaut scan**

In `scripts/tests/german-umlauts.test.ts`, add these files to `filesToCheck`:

```ts
  "src/lib/outreach/resourcePlans.ts",
  "src/components/outreach/ResourcePlanCard.tsx",
  "src/components/outreach/ResourcePlanDetailDialog.tsx",
```

- [ ] **Step 2: Add public-label assertions to the normalization test**

In `scripts/tests/resource-plan-normalization.test.ts`, after `assert.doesNotMatch(brief, /Linkbait/);`, add:

```ts
assert.equal(hasForbiddenPublicTerm("Linkmagnet"), true);
assert.equal(hasForbiddenPublicTerm("Link-Magnet"), true);
assert.equal(hasForbiddenPublicTerm("Kostenlose Ressource"), false);
```

- [ ] **Step 3: Run copy tests**

Run:

```bash
npx --yes tsx scripts/tests/resource-plan-normalization.test.ts
npx --yes tsx scripts/tests/german-umlauts.test.ts
```

Expected:

```text
resource-plan-normalization tests passed
german umlaut tests passed
```

- [ ] **Step 4: Commit Task 5**

Run:

```bash
git add scripts/tests/german-umlauts.test.ts scripts/tests/resource-plan-normalization.test.ts
git commit -m "test: cover resource planner copy"
```

Expected: commit succeeds.

---

### Task 6: Full Verification and Production Deploy

**Files:**
- No code files created in this task.

- [ ] **Step 1: Run all script tests touched by this feature**

Run:

```bash
npx --yes tsx scripts/tests/resource-plan-normalization.test.ts
npx --yes tsx scripts/tests/outreach-resource-plan-contract.test.ts
npx --yes tsx scripts/tests/anthropic-tool-input.test.ts
npx --yes tsx scripts/tests/german-umlauts.test.ts
```

Expected:

```text
resource-plan-normalization tests passed
outreach-resource-plan-contract tests passed
anthropic-tool-input tests passed
german umlaut tests passed
```

- [ ] **Step 2: Run targeted lint**

Run:

```bash
npx eslint src/lib/outreach/resourcePlans.ts src/inngest/functions/growth/outreachIntelligence.ts src/components/outreach/OutreachIntelligencePanel.tsx src/components/outreach/ResourcePlanCard.tsx src/components/outreach/ResourcePlanDetailDialog.tsx scripts/tests/resource-plan-normalization.test.ts scripts/tests/outreach-resource-plan-contract.test.ts scripts/tests/anthropic-tool-input.test.ts scripts/tests/german-umlauts.test.ts
```

Expected: no lint errors.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Run Vercel production build**

Run:

```bash
npx vercel build --prod
```

Expected: Vercel prebuild succeeds and writes `.vercel/output`.

- [ ] **Step 5: Deploy prebuilt output**

Run:

```bash
npx vercel deploy --prebuilt --prod --yes
```

Expected: command returns a production deployment URL.

- [ ] **Step 6: Verify Inngest API is still live**

Run:

```powershell
(Invoke-WebRequest -UseBasicParsing https://notamsign.com/api/inngest).Content
```

Expected: JSON response contains `"function_count"` with the current Inngest function count.

- [ ] **Step 7: Commit final verification note if generated files changed**

Run:

```bash
git status --short
```

Expected: no uncommitted source changes except generated deployment metadata that should not be committed. If source changes remain, inspect them with `git diff` and commit only intentional code/test files.

- [ ] **Step 8: Push main**

Run:

```bash
git push origin main
```

Expected: push succeeds and `git status --short --branch` shows `main...origin/main`.

---

## Self-Review

Spec coverage:

- Resource-format taxonomy from the seminar is implemented in Task 1.
- The “not public Linkbait” rule is implemented in Task 1, enforced in Task 2 prompt, and tested in Task 5.
- Entkommerzialisierung, Linkzielgruppen, DACH-fit, build brief, and outreach raw material are part of the `ResourcePlan` type in Task 1 and the Anthropic tool contract in Task 2.
- The first build stays inside the existing Outreach page in Task 4.
- No Convex schema migration is included, matching the MVP persistence decision.

Placeholder scan:

- The plan contains concrete file paths, commands, expected outputs, and code blocks.
- The plan has no placeholder markers or unspecified implementation steps.

Type consistency:

- `ResourcePlan` is created once in `src/lib/outreach/resourcePlans.ts`.
- The agent imports the same `ResourcePlan` type.
- The UI imports the same `ResourcePlan` type and receives it through normalized opportunities.
