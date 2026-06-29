import assert from "node:assert/strict";
import {
  buildAssetInventory,
  type AssetInventoryContext,
  type AssetInventorySitemap,
} from "../../src/lib/outreach/assetInventory";

const context: AssetInventoryContext = {
  crawlPages: [
    {
      id: "page-1",
      url: "https://example.com/resources",
      title: "Downloads und Rechner",
      contentExcerpt:
        "Nutzen Sie unseren ROI Rechner, die Checkliste als PDF und die Dokumente zum Download.",
      internalLinks: [
        "https://example.com/downloads/roi-rechner",
        "https://example.com/assets/checkliste-it-sicherheit.pdf",
        "https://example.com/vorlagen/audit-vorlage",
      ],
    },
    {
      id: "page-2",
      url: "https://example.com/glossar",
      title: "Glossar",
      contentExcerpt: "Begriffserklärungen ohne konkretes Hilfsmittel.",
      internalLinks: [],
    },
  ],
  contentAssets: [
    {
      id: "asset-1",
      assetType: "lead_magnet",
      title: "Whitepaper zur Kostenplanung",
      contentExcerpt: "Whitepaper mit Download für Budgetplanung.",
    },
  ],
};

const sitemap: AssetInventorySitemap = {
  urls: [
    {
      url: "https://example.com/tools/kostenrechner",
      source: "https://example.com/sitemap.xml",
    },
    {
      url: "https://example.com/downloads/checkliste.pdf",
      source: "https://example.com/sitemap.xml",
    },
  ],
};

const inventory = buildAssetInventory(context, sitemap);

assert.ok(
  inventory.existingAssets.some(
    (asset) =>
      asset.assetType === "calculator" &&
      asset.url === "https://example.com/downloads/roi-rechner"
  ),
  "should detect calculator links from crawl pages"
);

assert.ok(
  inventory.existingAssets.some(
    (asset) =>
      asset.assetType === "pdf_download" &&
      asset.url === "https://example.com/assets/checkliste-it-sicherheit.pdf"
  ),
  "should detect PDF/download links from crawl pages"
);

assert.ok(
  inventory.existingAssets.some(
    (asset) =>
      asset.assetType === "template" &&
      asset.url === "https://example.com/vorlagen/audit-vorlage"
  ),
  "should detect templates from crawl pages"
);

assert.ok(
  inventory.existingAssets.some(
    (asset) =>
      asset.assetType === "whitepaper" &&
      asset.title === "Whitepaper zur Kostenplanung"
  ),
  "should detect lead magnets from stored content assets"
);

assert.ok(
  inventory.existingAssets.some(
    (asset) =>
      asset.assetType === "calculator" &&
      asset.url === "https://example.com/tools/kostenrechner"
  ),
  "should detect calculator URLs from sitemap"
);

assert.ok(
  inventory.ideaSeeds.some((seed) => seed.recommendedFormat === "Kostenloses Tool")
);
assert.ok(
  inventory.ideaSeeds.some((seed) => seed.recommendedFormat === "Rechner / Kalkulator")
);

assert.ok(inventory.existingAssets.length <= 30);
assert.ok(inventory.ideaSeeds.length <= 12);

console.log("outreach-asset-inventory tests passed");
