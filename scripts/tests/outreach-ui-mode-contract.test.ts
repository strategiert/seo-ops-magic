import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(
  "src/components/outreach/OutreachIntelligencePanel.tsx",
  "utf8"
);
const card = readFileSync("src/components/outreach/ResourcePlanCard.tsx", "utf8");

assert.match(
  panel,
  /Neue Ideen entwickeln/,
  "Outreach UI must expose a visible new-ideas action"
);

assert.match(
  panel,
  /handleStart\("new_ideas"\)/,
  "New-ideas action must start the trigger with analysisMode new_ideas"
);

assert.match(
  panel,
  /handleStart\("full"\)/,
  "Full analysis action must start the trigger with analysisMode full"
);

assert.match(
  panel,
  /triggerIntelligence\(\{\s*projectId,\s*analysisMode\s*\}\)/,
  "Outreach UI must forward the selected analysis mode to Convex"
);

assert.match(
  panel,
  /Vorhandene Assets/,
  "Outreach UI must group opportunities adapted from existing assets"
);

assert.match(
  panel,
  /Content-Upgrades/,
  "Outreach UI must keep content upgrades separate from new ideas"
);

assert.match(
  card,
  /existing_asset:\s*"Vorhandenes Asset"/,
  "Resource plan cards must label existing asset opportunities"
);

console.log("outreach-ui-mode-contract tests passed");
