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

const resourceFormats: readonly string[] = RESOURCE_FORMATS;

for (const format of requiredFormats) {
  assert.ok(
    resourceFormats.includes(format),
    `Missing resource format: ${format}`
  );
}

assert.equal(hasForbiddenPublicTerm("link bait"), true);
assert.equal(hasForbiddenPublicTerm("Linkmagnet"), true);
assert.equal(hasForbiddenPublicTerm("Link-Magnet"), true);
assert.equal(hasForbiddenPublicTerm("Kostenlose Ressource"), false);

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
