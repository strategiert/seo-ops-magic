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
