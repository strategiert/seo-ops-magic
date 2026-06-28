import assert from "node:assert/strict";
import { extractToolInput } from "../../src/inngest/lib/anthropicToolInput";

const toolInput = {
  summary: "Beste Chance ist ein Elternratgeber.",
  sourceCoverage: {
    usedSources: ["crawl", "sitemap"],
    missingSources: [],
    confidence: 0.84,
  },
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
};

assert.deepEqual(
  extractToolInput(
    [
      {
        type: "tool_use",
        id: "toolu_123",
        name: "submit_outreach_intelligence",
        input: toolInput,
      },
    ],
    "submit_outreach_intelligence"
  ),
  toolInput
);

assert.throws(
  () =>
    extractToolInput(
      [
        {
          type: "text",
          text: '{"opportunities":[{"title":"A"} {"title":"B"}]}',
        },
      ],
      "submit_outreach_intelligence"
    ),
  /Tool response submit_outreach_intelligence not found/
);

console.log("anthropic-tool-input tests passed");
