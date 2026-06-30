import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const schema = read("convex/schema.ts");
const outreachInternal = read("convex/tables/outreachInternal.ts");
const outreachTable = read("convex/tables/outreach.ts");
const intelligence = read("src/inngest/functions/growth/outreachIntelligence.ts");
const badge = read("src/components/outreach/ProspectStatusBadge.tsx");
const detailPage = read("src/pages/OutreachCampaignDetail.tsx");

assert.match(schema, /'missing' \| 'found' \| 'unverified' \| 'verified' \| 'bad'/);

assert.match(outreachInternal, /contactStatus:\s*"unverified"/);
assert.doesNotMatch(
  outreachInternal,
  /contactStatus:\s*hasContactLocation\(prospect\) \? "found" : "missing"/,
  "AI-generated contact locations must not be marked found"
);

assert.match(intelligence, /fallbackUsed:\s*boolean/);
assert.match(intelligence, /const fallbackUsed = opportunities\.length === 0/);
assert.match(intelligence, /status:\s*generated\.fallbackUsed \? "needs_review" : "ready"/);

assert.match(outreachTable, /updates\.status !== "verified"/);
assert.match(outreachTable, /patchData\.verifiedAt = undefined/);

assert.match(badge, /unverified:\s*"KI-Vorschlag"/);
assert.match(detailPage, /prospect\.contactStatus/);
assert.match(detailPage, /<TableHead>Kontakt<\/TableHead>/);

console.log("outreach-p1-quality-contract tests passed");
