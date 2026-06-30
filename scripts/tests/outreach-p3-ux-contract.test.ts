import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const triggers = read("convex/agents/triggers.ts");
const detail = read("src/pages/OutreachCampaignDetail.tsx");
const importDialog = read("src/components/outreach/ProspectImportDialog.tsx");

assert.match(triggers, /getJobStatusByEventId/);
assert.match(triggers, /by_inngest_event/);

assert.match(detail, /strategyEventId/);
assert.match(detail, /getJobStatusByEventId/);
assert.match(detail, /isStrategyRunning/);
assert.match(detail, /variant:\s*"destructive"/);
assert.match(detail, /isValidHttpUrl/);
assert.match(detail, /relOptions = \["dofollow", "nofollow", "sponsored", "ugc"\]/);
assert.match(detail, /EmptyState/);
assert.match(detail, /Strategie generieren/);

assert.match(importDialog, /detectHeader/);
assert.match(importDialog, /invalidRows/);
assert.match(importDialog, /contactName/);
assert.match(importDialog, /Vorschau/);
assert.match(importDialog, /Ungueltige Zeilen/);

console.log("outreach-p3-ux-contract tests passed");
