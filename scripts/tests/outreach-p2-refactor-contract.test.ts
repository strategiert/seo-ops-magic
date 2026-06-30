import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
const schema = read("convex/schema.ts");
const outreach = read("convex/tables/outreach.ts");
const intelligence = read("convex/tables/outreachIntelligence.ts");
const internal = read("convex/tables/outreachInternal.ts");

assert.match(pkg.scripts?.test ?? "", /scripts\/tests\/run-all\.ts/);

assert.doesNotMatch(schema, /outreachAssets:\s*defineTable/);
assert.doesNotMatch(outreach, /outreachAssets/);
assert.doesNotMatch(outreach, /\bassets\b/);

assert.match(schema, /campaignTypeValidator/);
assert.match(schema, /outreachCampaignStatusValidator/);
assert.match(schema, /contactStatusValidator/);
assert.match(schema, /goalStatusValidator/);

assert.match(outreach, /requireProjectAccess/);
assert.doesNotMatch(outreach, /async function verifyProjectAccess/);

assert.match(intelligence, /requireProjectAccess/);
assert.match(intelligence, /\.order\("desc"\)\s*\.first\(\)/);
assert.doesNotMatch(intelligence, /collect\(\);\s*[\s\S]{0,120}sort\(/);

assert.match(outreach, /stripUndefined/);
assert.match(internal, /stripUndefined/);
assert.doesNotMatch(outreach, /function stripUndefined/);
assert.doesNotMatch(internal, /function stripUndefined/);

console.log("outreach-p2-refactor-contract tests passed");
