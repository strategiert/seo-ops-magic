import { serve } from "inngest/vercel";
import { inngest } from "../src/inngest/client";

// Import implemented agent functions
import { seoContentWriter } from "../src/inngest/functions/core/seoWriter";
import { htmlDesigner } from "../src/inngest/functions/core/htmlDesigner";
import { wordpressPublisher } from "../src/inngest/functions/core/wpPublisher";
import { internalLinker } from "../src/inngest/functions/core/internalLinker";
import { socialPostCreator } from "../src/inngest/functions/growth/socialCreator";

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
  ],
});
