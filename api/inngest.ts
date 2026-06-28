import { serve } from "inngest/express";
import { inngest } from "../src/inngest/client.js";

// Import implemented agent functions
import { seoContentWriter } from "../src/inngest/functions/core/seoWriter.js";
import { htmlDesigner } from "../src/inngest/functions/core/htmlDesigner.js";
import { wordpressPublisher } from "../src/inngest/functions/core/wpPublisher.js";
import { internalLinker } from "../src/inngest/functions/core/internalLinker.js";
import { socialPostCreator } from "../src/inngest/functions/growth/socialCreator.js";
import { outreachStrategy } from "../src/inngest/functions/growth/outreachStrategy.js";
import { outreachIntelligence } from "../src/inngest/functions/growth/outreachIntelligence.js";

// NOTE: adCopyWriter, pressReleaseWriter and fullContentPipeline are stubs
// (TODOs: Convex persistence, credit handling, agentJobs status updates).
// Registering them caused queued jobs to hang forever in the UI. They are
// intentionally excluded until their implementations are complete.

export default serve({
  client: inngest,
  functions: [
    seoContentWriter,
    htmlDesigner,
    wordpressPublisher,
    internalLinker,
    socialPostCreator,
    outreachStrategy,
    outreachIntelligence,
  ],
});
