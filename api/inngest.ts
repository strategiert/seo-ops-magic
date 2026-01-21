import { serve } from "inngest/vercel";
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

/**
 * Inngest API Handler for Vercel
 *
 * This endpoint:
 * 1. Receives events from Inngest
 * 2. Routes them to the appropriate agent functions
 * 3. Handles retries and error reporting
 *
 * All 18 agents will be registered here as they are implemented.
 */
export default serve({
  client: inngest,
  functions: [
    // Core Tier (Basis)
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
});
