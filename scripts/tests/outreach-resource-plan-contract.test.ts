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

assert.match(
  source,
  /buildAssetInventory/,
  "Agent must build an explicit inventory of existing calculators, downloads, tools, templates, and other assets"
);

assert.match(
  source,
  /Analysemodus/,
  "Agent prompt context must expose whether it should run a full analysis or focus on new ideas"
);

assert.match(
  source,
  /Vorhandene Assets/,
  "Agent prompt context must make existing lead magnets and asset candidates visible"
);

console.log("outreach-resource-plan-contract tests passed");
