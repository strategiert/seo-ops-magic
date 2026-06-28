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
