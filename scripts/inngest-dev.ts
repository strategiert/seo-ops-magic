/**
 * Local Inngest Dev Server
 *
 * Run with: npx tsx scripts/inngest-dev.ts
 *
 * This serves the Inngest endpoint locally for development.
 * The Inngest Dev Server (http://localhost:8288) will connect to this.
 */

// Load environment variables from .env files
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

// Map VITE_CONVEX_URL to CONVEX_URL for server-side use
if (!process.env.CONVEX_URL && process.env.VITE_CONVEX_URL) {
  process.env.CONVEX_URL = process.env.VITE_CONVEX_URL;
}

import express from "express";
import { serve } from "inngest/express";
import { inngest } from "../src/inngest/client";

// Import all agent functions
import { seoContentWriter } from "../src/inngest/functions/core/seoWriter";
import { htmlDesigner } from "../src/inngest/functions/core/htmlDesigner";
import { wordpressPublisher } from "../src/inngest/functions/core/wpPublisher";
import { internalLinker } from "../src/inngest/functions/core/internalLinker";
import { socialPostCreator } from "../src/inngest/functions/growth/socialCreator";
import { adCopyWriter } from "../src/inngest/functions/growth/adCopyWriter";
import { pressReleaseWriter } from "../src/inngest/functions/enterprise/pressRelease";

// Import workflows
import { fullContentPipeline } from "../src/inngest/workflows/fullContentPipeline";

const app = express();
const port = 3001;

// Inngest endpoint
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      // Core Tier
      seoContentWriter,
      htmlDesigner,
      wordpressPublisher,
      internalLinker,
      // Growth Tier
      socialPostCreator,
      adCopyWriter,
      // Enterprise Tier
      pressReleaseWriter,
      // Workflows
      fullContentPipeline,
    ],
  })
);

app.listen(port, () => {
  console.log(`\n🚀 Inngest Dev Server running at http://localhost:${port}/api/inngest`);
  console.log(`\n📋 Registered functions:`);
  console.log(`   - seo-content-writer (10 credits)`);
  console.log(`   - html-designer (3 credits)`);
  console.log(`   - wordpress-publisher (1 credit)`);
  console.log(`   - internal-linker (5 credits)`);
  console.log(`   - social-post-creator (5 credits)`);
  console.log(`   - ad-copy-writer (4 credits)`);
  console.log(`   - press-release-writer (6 credits)`);
  console.log(`   - full-content-pipeline (workflow)`);
  console.log(`\n👉 Open http://localhost:8288 to see the Inngest Dev Server`);
  console.log(`   Add this app URL: http://localhost:${port}/api/inngest\n`);
});
