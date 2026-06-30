import assert from "node:assert/strict";
import { assertSafePublicHttpUrl } from "../../src/inngest/lib/safeHttp";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 as const }];
const privateLookup = async () => [{ address: "10.0.0.1", family: 4 as const }];
const ipv6PrivateLookup = async () => [{ address: "fc00::1", family: 6 as const }];

assert.equal(
  (await assertSafePublicHttpUrl("https://example.com/sitemap.xml", publicLookup)).href,
  "https://example.com/sitemap.xml"
);

await assert.rejects(
  () => assertSafePublicHttpUrl("ftp://example.com/sitemap.xml", publicLookup),
  /Only http\(s\) URLs are allowed/
);

await assert.rejects(
  () => assertSafePublicHttpUrl("https://example.com:8443/sitemap.xml", publicLookup),
  /Only ports 80 and 443 are allowed/
);

await assert.rejects(
  () => assertSafePublicHttpUrl("https://localhost/sitemap.xml", publicLookup),
  /Localhost URLs are not allowed/
);

await assert.rejects(
  () => assertSafePublicHttpUrl("http://169.254.169.254/latest/meta-data", publicLookup),
  /private or reserved address/
);

await assert.rejects(
  () => assertSafePublicHttpUrl("https://example.com/sitemap.xml", privateLookup),
  /private or reserved address/
);

await assert.rejects(
  () => assertSafePublicHttpUrl("https://example.com/sitemap.xml", ipv6PrivateLookup),
  /private or reserved address/
);

console.log("outreach-safe-http tests passed");
