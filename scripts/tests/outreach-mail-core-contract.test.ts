import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const schema = read("convex/schema.ts");
const validators = read("convex/lib/outreachValidators.ts");
const outreachMail = read("convex/tables/outreachMail.ts");
const triggers = read("convex/agents/triggers.ts");
const client = read("src/inngest/client.ts");
const worker = read("src/inngest/functions/growth/outreachSendMessage.ts");
const inngestApi = read("api/inngest.ts");
const detail = read("src/pages/OutreachCampaignDetail.tsx");
const runAll = read("scripts/tests/run-all.ts");

for (const tableName of [
  "outreachMailboxes",
  "outreachSuppressions",
  "outreachMessages",
  "outreachEmailEvents",
]) {
  assert.match(schema, new RegExp(`${tableName}: defineTable`));
}

for (const validatorName of [
  "outreachMailboxStatusValidator",
  "outreachMessageStatusValidator",
  "outreachSuppressionScopeValidator",
  "outreachEmailEventTypeValidator",
]) {
  assert.match(validators, new RegExp(`export const ${validatorName}`));
}

assert.match(outreachMail, /requireProjectAccess/);
assert.match(outreachMail, /export const getCampaignSendReadiness/);
assert.match(outreachMail, /export const queueCampaignFirstStep/);
assert.match(outreachMail, /export const markMessageSending/);
assert.match(outreachMail, /export const markMessageSent/);
assert.match(outreachMail, /export const markMessageFailed/);
assert.match(outreachMail, /outreachSuppressions/);
assert.match(outreachMail, /buildOutreachEmailDraft/);

assert.match(triggers, /triggerOutreachMessageSend/);
assert.match(triggers, /outreach\/send-message/);
assert.match(client, /"outreach\/send-message"/);
assert.match(worker, /new Resend/);
assert.match(worker, /RESEND_API_KEY/);
assert.match(worker, /emails\.send/);
assert.match(worker, /markMessageSent/);
assert.match(worker, /markMessageFailed/);
assert.match(inngestApi, /outreachSendMessage/);

assert.match(detail, /TabsTrigger value="send"/);
assert.match(detail, /Versand/);
assert.match(detail, /triggerOutreachMessageSend/);
assert.match(detail, /getCampaignSendReadiness/);

assert.match(runAll, /outreach-mail-core\.test\.ts/);
assert.match(runAll, /outreach-mail-core-contract\.test\.ts/);

console.log("outreach-mail-core-contract tests passed");
