import { spawnSync } from "node:child_process";

const tests = [
  "scripts/tests/outreach-safe-http.test.ts",
  "scripts/tests/outreach-p0-hardening-contract.test.ts",
  "scripts/tests/outreach-p1-quality-contract.test.ts",
  "scripts/tests/outreach-p2-refactor-contract.test.ts",
  "scripts/tests/outreach-p3-ux-contract.test.ts",
  "scripts/tests/outreach-resource-plan-contract.test.ts",
  "scripts/tests/outreach-asset-inventory.test.ts",
  "scripts/tests/outreach-ui-mode-contract.test.ts",
  "scripts/tests/outreach-mail-core.test.ts",
  "scripts/tests/outreach-mail-core-contract.test.ts",
  "scripts/tests/resource-plan-normalization.test.ts",
  "scripts/tests/german-umlauts.test.ts",
  "scripts/tests/anthropic-tool-input.test.ts",
];

for (const test of tests) {
  const result = spawnSync("npx", ["tsx", test], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
