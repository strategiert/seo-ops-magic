import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const schema = read("convex/schema.ts");
const agentInternal = read("convex/agents/internal.ts");
const agentActions = read("convex/agents/actions.ts");
const outreachActions = read("convex/agents/outreachActions.ts");
const intelligenceActions = read("convex/agents/outreachIntelligenceActions.ts");
const intelligenceTable = read("convex/tables/outreachIntelligence.ts");
const outreachInternal = read("convex/tables/outreachInternal.ts");
const strategy = read("src/inngest/functions/growth/outreachStrategy.ts");
const intelligence = read("src/inngest/functions/growth/outreachIntelligence.ts");

assert.match(schema, /creditsRefunded:\s*v\.optional\(v\.boolean\(\)\)/);
assert.match(schema, /creditsRefundedAt:\s*v\.optional\(v\.number\(\)\)/);
assert.match(schema, /creditsReservedAt:\s*v\.optional\(v\.number\(\)\)/);

assert.match(agentInternal, /reservationKey:\s*v\.optional\(v\.string\(\)\)/);
assert.match(agentInternal, /refundReservedCredits/);
assert.match(agentInternal, /creditsRefunded/);
assert.match(agentInternal, /!existingJob\.creditsRefunded/);
assert.match(agentInternal, /creditsReservedAt/);
assert.match(agentInternal, /by_inngest_event/);

assert.match(agentActions, /refundReservedCredits/);
assert.match(agentActions, /reservationKey:\s*v\.optional\(v\.string\(\)\)/);

for (const source of [outreachActions, intelligenceActions]) {
  assert.match(
    source,
    /OUTREACH_WORKER_SECRET in Convex \+ Vercel setzen/,
    "Temporary worker-secret fallback must stay explicit until both deployments have OUTREACH_WORKER_SECRET"
  );
}

assert.match(strategy, /const inngestEventId = event\.id \|\|/);
assert.match(strategy, /try\s*{/);
assert.match(strategy, /catch\s*\(error\)/);
assert.match(strategy, /refundReservedCredits/);
assert.match(strategy, /reservationKey:\s*inngestEventId/);
assert.match(strategy, /creditsReserved:\s*0/);

assert.match(intelligence, /refundReservedCredits/);
assert.match(intelligence, /reservationKey:\s*inngestEventId/);
assert.match(intelligence, /fetchSafeTextWithTimeout/);
assert.match(intelligence, /creditsReserved:\s*0/);

for (const source of [outreachActions, intelligenceActions, intelligenceTable, outreachInternal]) {
  assert.match(source, /userId:\s*v\.string\(\)/, "Worker path must receive userId");
  assert.match(source, /workspaceId:\s*v\.(?:string|id\("workspaces"\))/, "Worker path must receive workspaceId");
}

for (const source of [intelligenceTable, outreachInternal]) {
  assert.match(source, /ownerId\s*!==\s*userId/, "Worker path must verify workspace owner");
}

assert.doesNotMatch(
  intelligenceTable,
  /ctx\.db\.query\("bodycamPages"\)\.collect\(\)/,
  "Outreach intelligence context must not collect global bodycamPages"
);

console.log("outreach-p0-hardening-contract tests passed");
