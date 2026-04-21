/**
 * Agent Index - Exportiert alle Inngest Agent Functions
 * 
 * Diese Datei wird von der Inngest serve() Funktion importiert.
 * Alle Agents müssen hier registriert werden.
 */

// Router Agent (Orchestrierung)
export { routerAgent } from "./agents/routerAgent";

// Core Agents
export { seoContentWriter } from "./functions/core/seoWriter";
export { htmlDesigner } from "./functions/core/htmlDesigner";
export { internalLinker } from "./functions/core/internalLinker";
export { wordpressPublisher } from "./functions/core/wordpressPublisher";

// Growth Agents
export { socialPostCreator } from "./functions/growth/socialCreator";
export { adCopyWriter } from "./functions/growth/adCopyWriter";

// Enterprise Agents
export { pressReleaseWriter } from "./functions/enterprise/pressRelease";

// Workflows
export { fullContentPipeline } from "./workflows/fullContentPipeline";

// All functions array for serve()
import { routerAgent } from "./agents/routerAgent";
import { seoContentWriter } from "./functions/core/seoWriter";
import { htmlDesigner } from "./functions/core/htmlDesigner";
import { internalLinker } from "./functions/core/internalLinker";
import { wordpressPublisher } from "./functions/core/wordpressPublisher";
import { socialPostCreator } from "./functions/growth/socialCreator";
import { adCopyWriter } from "./functions/growth/adCopyWriter";
import { pressReleaseWriter } from "./functions/enterprise/pressRelease";
import { fullContentPipeline } from "./workflows/fullContentPipeline";

export const allAgentFunctions = [
  routerAgent,
  seoContentWriter,
  htmlDesigner,
  internalLinker,
  wordpressPublisher,
  socialPostCreator,
  adCopyWriter,
  pressReleaseWriter,
  fullContentPipeline,
];
