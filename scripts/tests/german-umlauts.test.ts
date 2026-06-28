import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const filesToCheck = [
  "src/inngest/functions/growth/outreachIntelligence.ts",
  "src/inngest/functions/growth/outreachStrategy.ts",
  "src/components/outreach/SequenceEditor.tsx",
  "src/components/outreach/CreateCampaignDialog.tsx",
  "src/components/outreach/ProspectImportDialog.tsx",
];

const asciiUmlautWords = [
  "fuer",
  "zurueck",
  "gueltig",
  "moeglich",
  "koennte",
  "koennen",
  "natuerliche",
  "Qualitaet",
  "Rueckfragen",
  "Fuell",
  "gestossen",
  "Gruesse",
  "Ergaenzung",
  "ausschliesslich",
  "ausser",
  "ausgewaehlt",
  "waehle",
  "fuege",
  "Eintraege",
  "hinzugefuegt",
  "hinzufuegen",
  "erklaere",
  "kampagnenfaehig",
  "linkwuerdiger",
];

const findings = filesToCheck.flatMap((file) => {
  const content = readFileSync(file, "utf8");
  return asciiUmlautWords
    .filter((word) => new RegExp(`\\b${word}\\b`).test(content))
    .map((word) => `${file}: ${word}`);
});

assert.deepEqual(findings, []);

console.log("german umlaut tests passed");
