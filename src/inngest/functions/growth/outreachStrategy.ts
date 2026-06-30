import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { inngest } from "../../client.js";
import { api, convex, AGENT_CREDITS, calculateCostCents } from "../../lib/convex.js";
import { extractToolInput } from "../../lib/anthropicToolInput.js";

const AGENT_ID = "outreach-strategy";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];
const OUTREACH_STRATEGY_TOOL_NAME = "submit_outreach_strategy";

const SYSTEM_PROMPT = `Du bist der Outreach Strategy Agent für SEO Ops Magic.

Du erstellst Outreach-Kampagnen für unterschiedliche Kampagnentypen. In dieser Version ist nur campaignType="linkbuilding" aktiv.

Für Linkbuilding:
- Priorisiere thematische Relevanz, Linkwahrscheinlichkeit und natürliche Outreach-Argumente.
- Nutze Methoden wie Resource Page Outreach, Broken Link Building, Guest Posting, Competitor Replication, Unlinked Mentions, Expert Quote Outreach, Partner Links und Linkbait Promotion.
- Scoring: Relevanz 30%, Domain-/Seitenqualität 25%, Linkwahrscheinlichkeit 20%, Kontaktierbarkeit 15%, Aufwand 10%.
- Tier A = 0.8-1.0, B = 0.6-0.79, C = 0.4-0.59, D = unter 0.4.
- Schreibe auf Deutsch, klar, professionell und konkret.

Antworte ausschließlich als gültiges JSON:
{
  "strategy": {
    "summary": "string",
    "positioning": "string",
    "recommendedMethods": ["string"],
    "searchOperators": ["string"],
    "risks": ["string"],
    "nextActions": ["string"]
  },
  "prospects": [
    {
      "domain": "example.com",
      "url": "https://example.com/resources",
      "method": "resource_page",
      "score": 0.82,
      "tier": "A",
      "reasoning": "Warum diese Chance sinnvoll ist",
      "contactEmail": "optional@example.com",
      "contactName": "Optional Name",
      "contactPage": "https://example.com/contact"
    }
  ],
  "sequence": {
    "name": "Linkbuilding Outreach",
    "steps": [
      {
        "dayOffset": 0,
        "subject": "Kurzer Hinweis zu {{siteName}}",
        "body": "Plain text Mail mit Variablen."
      },
      {
        "dayOffset": 4,
        "subject": "Re: Kurzer Hinweis zu {{siteName}}",
        "body": "Plain text Follow-up."
      }
    ],
    "variants": {
      "resource_page": "Hinweis für Resource Pages",
      "broken_link": "Hinweis für Broken Link Outreach"
    }
  }
}`;

const OUTREACH_STRATEGY_TOOL: Tool = {
  name: OUTREACH_STRATEGY_TOOL_NAME,
  description: "Gibt Outreach-Strategie, Prospects und Sequenz strukturiert zurück.",
  input_schema: {
    type: "object",
    properties: {
      strategy: {
        type: "object",
        additionalProperties: true,
      },
      prospects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            domain: { type: "string" },
            url: { type: "string" },
            method: { type: "string" },
            score: { type: "number" },
            tier: { type: "string" },
            reasoning: { type: "string" },
            contactEmail: { type: "string" },
            contactName: { type: "string" },
            contactPage: { type: "string" },
          },
          required: ["domain"],
          additionalProperties: true,
        },
      },
      sequence: {
        type: "object",
        properties: {
          name: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayOffset: { type: "number" },
                subject: { type: "string" },
                body: { type: "string" },
              },
              required: ["dayOffset", "subject", "body"],
              additionalProperties: true,
            },
          },
          variants: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        additionalProperties: true,
      },
    },
    required: ["strategy", "prospects", "sequence"],
    additionalProperties: true,
  },
};

type OutreachEventData = {
  campaignId: string;
  projectId: string;
  userId: string;
  workspaceId: string;
  customerId: string;
};

type ArticleContext = {
  title?: string;
  primaryKeyword?: string;
  metaDescription?: string;
  contentMarkdown?: string;
};

type CampaignContext = {
  campaign: unknown;
  project: unknown;
  brandProfile: unknown;
  articles?: ArticleContext[];
  prospects?: unknown[];
};

type GeneratedProspect = {
  domain: string;
  url?: string;
  method?: string;
  score?: number;
  tier?: string;
  reasoning?: string;
  contactEmail?: string;
  contactName?: string;
  contactPage?: string;
};

type SequenceStep = {
  dayOffset: number;
  subject: string;
  body: string;
};

type GeneratedSequence = {
  name: string;
  steps: SequenceStep[];
  variants?: Record<string, string>;
};

type GeneratedStrategy = {
  strategy: unknown;
  prospects: GeneratedProspect[];
  sequence: GeneratedSequence;
};

function getWorkerSecret(): string {
  const workerSecret = process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;
  if (!workerSecret) {
    throw new Error("OUTREACH_WORKER_SECRET is not configured");
  }
  return workerSecret;
}

function safeStringify(value: unknown, maxLength: number): string {
  const text = JSON.stringify(value, null, 2) || "";
  return text.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asTier(value: unknown): string | undefined {
  const text = asString(value)?.toUpperCase();
  if (!text) return undefined;

  const tier = text.match(/[ABCD]/)?.[0];
  return tier && ["A", "B", "C", "D"].includes(tier) ? tier : undefined;
}

function defaultSequence(): GeneratedSequence {
  return {
    name: "Linkbuilding Outreach",
    steps: [
      {
        dayOffset: 0,
        subject: "Kurzer Hinweis zu {{siteName}}",
        body:
          "Hallo {{firstName}},\n\nich bin auf {{siteName}} gestoßen und dachte, unsere Ressource zu {{topic}} könnte für Ihre Leser hilfreich sein.\n\nViele Grüße\n{{senderName}}",
      },
      {
        dayOffset: 4,
        subject: "Re: Kurzer Hinweis zu {{siteName}}",
        body:
          "Hallo {{firstName}},\n\nich wollte kurz nachhaken, ob die Ressource zu {{topic}} für Ihre Seite interessant sein könnte.\n\nViele Grüße\n{{senderName}}",
      },
    ],
    variants: {
      resource_page: "Als hilfreiche Ressource für eine bestehende Link-/Ressourcenseite positionieren.",
      broken_link: "Auf einen kaputten oder veralteten Link hinweisen und die eigene Ressource als Ersatz anbieten.",
    },
  };
}

function normalizeProspects(value: unknown): GeneratedProspect[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((prospect) => ({
      domain: asString(prospect.domain) || "",
      url: asString(prospect.url),
      method: asString(prospect.method),
      score: asNumber(prospect.score),
      tier: asTier(prospect.tier),
      reasoning: asString(prospect.reasoning),
      contactEmail: asString(prospect.contactEmail),
      contactName: asString(prospect.contactName),
      contactPage: asString(prospect.contactPage),
    }))
    .filter((prospect) => prospect.domain.length > 0);
}

function normalizeSequence(value: unknown): GeneratedSequence {
  if (!isRecord(value)) return defaultSequence();

  const rawSteps = Array.isArray(value.steps) ? value.steps.filter(isRecord) : [];
  const steps = rawSteps
    .map((step) => ({
      dayOffset: asNumber(step.dayOffset) ?? 0,
      subject: asString(step.subject) || "Kurzer Hinweis zu {{siteName}}",
      body: asString(step.body) || defaultSequence().steps[0].body,
    }))
    .filter((step) => step.body.length > 0);

  return {
    name: asString(value.name) || "Linkbuilding Outreach",
    steps: steps.length > 0 ? steps : defaultSequence().steps,
    variants: isRecord(value.variants)
      ? Object.fromEntries(
          Object.entries(value.variants)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        )
      : defaultSequence().variants,
  };
}

function normalizeGeneratedStrategy(value: unknown): GeneratedStrategy {
  if (!isRecord(value)) {
    throw new Error("Generated strategy JSON must be an object");
  }

  return {
    strategy: value.strategy || {},
    prospects: normalizeProspects(value.prospects),
    sequence: normalizeSequence(value.sequence),
  };
}

function formatArticleSummaries(articles: ArticleContext[] | undefined): string {
  if (!articles || articles.length === 0) {
    return "Keine Zielartikel ausgewählt.";
  }

  return articles
    .map((article) => {
      const preview = article.metaDescription || article.contentMarkdown || "";
      return `- ${article.title || "Ohne Titel"}: ${article.primaryKeyword || "kein Keyword"}\n${preview.slice(0, 500)}`;
    })
    .join("\n\n");
}

export const outreachStrategy = inngest.createFunction(
  {
    id: "outreach-strategy",
    name: "Outreach Strategy",
    concurrency: {
      limit: 3,
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "outreach/strategy" },
  async ({ event, step }) => {
    const { campaignId, projectId, userId, workspaceId } = event.data as OutreachEventData;
    const workerSecret = getWorkerSecret();
    const inngestEventId = event.id || `outreach-strategy-${Date.now()}`;
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      await step.run("create-job-record", async () => {
        await convex.action(api.agents.actions.createAgentJob, {
          inngestEventId,
          userId,
          workspaceId,
          projectId,
          agentId: AGENT_ID,
          eventType: "outreach/strategy",
          inputData: { campaignId },
          creditsReserved: 0,
        });
      });

      await step.run("check-credits", async () => {
        const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
          workspaceId,
          agentId: AGENT_ID,
          requiredCredits: CREDITS_REQUIRED,
          reservationKey: inngestEventId,
        });

        if (!result.success) {
          throw new Error(result.error || "Credit check failed");
        }
      });

      const context = await step.run("fetch-campaign-context", async () => {
        const result = await convex.action(api.agents.outreachActions.getCampaignContext, {
          campaignId,
          userId,
          workspaceId,
          workerSecret,
        }) as CampaignContext | null;

        if (!result?.campaign) {
          throw new Error(`Campaign not found: ${campaignId}`);
        }

        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "running",
          currentStep: "Fetching campaign context",
          progress: 15,
        });

        return result;
      });

      const generated = await step.run("generate-strategy", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          currentStep: "Generating outreach strategy",
          progress: 35,
        });

        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 5000,
          system: SYSTEM_PROMPT,
          tools: [OUTREACH_STRATEGY_TOOL],
          tool_choice: {
            type: "tool",
            name: OUTREACH_STRATEGY_TOOL_NAME,
          },
          messages: [
            {
              role: "user",
              content: `Erstelle eine Outreach-Strategie für diese Kampagne.

Kampagne:
${safeStringify(context.campaign, 4000)}

Projekt:
${safeStringify(context.project, 2000)}

Brand-Kontext:
${safeStringify(context.brandProfile, 4000)}

Zielartikel:
${formatArticleSummaries(context.articles)}

Bereits importierte Prospects:
${safeStringify(context.prospects || [], 5000)}

Gib nur JSON im geforderten Format zurück.`,
            },
          ],
        });

        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;

        return normalizeGeneratedStrategy(
          extractToolInput(response.content, OUTREACH_STRATEGY_TOOL_NAME)
        );
      });

      const saved = await step.run("save-strategy", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          currentStep: "Saving strategy",
          progress: 80,
        });

        return await convex.action(api.agents.outreachActions.saveStrategyOutput, {
          campaignId,
          userId,
          workspaceId,
          workerSecret,
          strategyJson: generated.strategy,
          prospects: generated.prospects,
          sequence: generated.sequence,
        });
      });

      const durationMs = Date.now() - startTime;

      await step.run("log-usage", async () => {
        await convex.action(api.agents.actions.logUsage, {
          userId,
          workspaceId,
          projectId,
          agentId: AGENT_ID,
          jobId: inngestEventId,
          creditsUsed: CREDITS_REQUIRED,
          inputTokens,
          outputTokens,
          status: "completed",
          durationMs,
        });

        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "completed",
          progress: 100,
          currentStep: "Done",
          creditsUsed: CREDITS_REQUIRED,
          result: {
            campaignId,
            prospectsCreated: saved.insertedProspectIds.length,
            sequenceId: saved.sequenceId,
          },
        });
      });

      return {
        success: true,
        campaignId,
        prospectsCreated: saved.insertedProspectIds.length,
        sequenceId: saved.sequenceId,
        creditsUsed: CREDITS_REQUIRED,
        durationMs,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown outreach strategy error";

      await step.run("mark-failed", async () => {
        await convex.action(api.agents.actions.refundReservedCredits, {
          inngestEventId,
          reason: errorMessage,
        });

        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId,
          status: "failed",
          currentStep: "Failed",
          progress: 100,
          errorMessage,
        });
      });

      throw error;
    }
  }
);
