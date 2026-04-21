import { inngest } from "../client";
import { convex, api, AGENT_CREDITS, calculateCostCents } from "../lib/convex";
import { getSkillSummaries, loadSkillDocument, skillExists } from "../lib/skillLoader";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Router Agent - Das Gehirn des Multi-Agent-Systems
 * 
 * Aufgaben:
 * 1. User-Intent analysieren (was will der User?)
 * 2. Workflow planen (welche Skills in welcher Reihenfolge?)
 * 3. Skills orchestrieren (Inngest Events senden)
 * 4. Ergebnisse aggregieren
 * 
 * Der Router sieht NUR:
 * - Skill-Summaries (nicht die vollen Dokumente)
 * - Artikel-Metadaten (nicht den vollen Content)
 * - Asset-IDs (nicht die generierten Inhalte)
 * 
 * Cost: 2 credits (nur Routing-Logik)
 */

const AGENT_ID = "router";
const CREDITS_REQUIRED = 2;

// Mapping von Skills zu Inngest Events
const SKILL_TO_EVENT: Record<string, string> = {
  "seo-content-writer": "article/generate",
  "html-designer": "article/transform-html",
  "wordpress-publisher": "article/publish-wordpress",
  "internal-linker": "article/analyze-links",
  "social-post-creator": "content/generate-social-posts",
  "ad-copy-writer": "content/generate-ad-copies",
  "press-release-writer": "content/generate-press-release",
  "newsletter-composer": "content/generate-newsletter",
  "content-translator": "content/translate",
  "image-generator": "asset/generate-images",
};

// Skills die NICHT selbst denken sollen (deterministisch)
const DETERMINISTIC_SKILLS = [
  "wordpress-publisher",
  "internal-linker", 
  "html-designer",
];

// Skills die selbst denken dürfen (kreativ)
const THINKING_SKILLS = [
  "seo-content-writer",
  "social-post-creator",
  "ad-copy-writer",
  "press-release-writer",
  "newsletter-composer",
  "content-translator",
  "image-generator",
];

interface RouterPlan {
  intent: string;
  reasoning: string;
  steps: {
    order: number;
    skillId: string;
    action: string;
    dependsOn: number[];
    estimatedCredits: number;
    requiresThinking: boolean;
  }[];
  totalEstimatedCredits: number;
  warnings: string[];
}

interface RouterInput {
  // Einer dieser Inputs muss vorhanden sein
  userMessage?: string;           // Freitext-Anfrage
  briefId?: string;               // Content Brief für Artikel-Erstellung
  articleId?: string;             // Existierender Artikel für Transformation
  // Optionale Steuerung
  requestedSkills?: string[];     // Explizit gewünschte Skills
  excludeSkills?: string[];       // Skills die nicht verwendet werden sollen
  autoExecute?: boolean;          // Plan direkt ausführen (default: false)
}

const ROUTER_SYSTEM_PROMPT = `Du bist ein intelligenter Router für ein Content-Operations-System.

## Deine Aufgabe
Analysiere die User-Anfrage und erstelle einen Ausführungsplan mit den verfügbaren Skills.

## Verfügbare Skills
{SKILL_SUMMARIES}

## Regeln
1. Wähle NUR Skills die wirklich benötigt werden
2. Beachte Abhängigkeiten (z.B. HTML-Designer braucht erst einen Artikel)
3. Parallelisiere wo möglich (unabhängige Skills können gleichzeitig laufen)
4. Schätze Credits realistisch

## Deterministische vs. Denkende Skills
- DETERMINISTISCH (kein LLM-Reasoning): wordpress-publisher, internal-linker, html-designer
  → Diese führen nur Code/Templates aus, kein kreatives Denken
- DENKEND (mit LLM-Reasoning): seo-content-writer, social-post-creator, ad-copy-writer, etc.
  → Diese dürfen kreativ arbeiten und eigene Entscheidungen treffen

## Output Format (JSON)
{
  "intent": "Kurze Beschreibung was der User will",
  "reasoning": "Deine Überlegungen zur Skill-Auswahl",
  "steps": [
    {
      "order": 1,
      "skillId": "skill-name",
      "action": "Was dieser Skill tun soll",
      "dependsOn": [],
      "estimatedCredits": 10,
      "requiresThinking": true
    }
  ],
  "totalEstimatedCredits": 15,
  "warnings": ["Optionale Warnungen"]
}`;

export const routerAgent = inngest.createFunction(
  {
    id: "router-agent",
    name: "Router Agent",
    concurrency: {
      limit: 5,
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "agent/route" },
  async ({ event, step }) => {
    const { 
      workspaceId, 
      projectId, 
      userId, 
      customerId,
      input 
    } = event.data as {
      workspaceId: string;
      projectId: string;
      userId: string;
      customerId: string;
      input: RouterInput;
    };

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Step 1: Credits prüfen
    await step.run("check-credits", async () => {
      const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
        workspaceId,
        agentId: AGENT_ID,
        requiredCredits: CREDITS_REQUIRED,
      });

      if (!result.success) {
        throw new Error(result.error || "Credit check failed");
      }
    });

    // Step 2: Job-Record erstellen
    await step.run("create-job-record", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "agent/route",
        inputData: input,
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    // Step 3: Kontext sammeln (Metadaten, nicht Volltext!)
    const context = await step.run("gather-context", async () => {
      const ctx: {
        briefSummary?: { id: string; title: string; primaryKeyword: string; status: string };
        articleSummary?: { id: string; title: string; hasMarkdown: boolean; hasHtml: boolean; status: string };
        existingAssets?: { type: string; platform?: string; count: number }[];
      } = {};

      if (input.briefId) {
        const brief = await convex.action(api.agents.actions.getBrief, {
          briefId: input.briefId,
        });
        if (brief) {
          ctx.briefSummary = {
            id: input.briefId,
            title: brief.title,
            primaryKeyword: brief.primaryKeyword,
            status: brief.status || "pending",
          };
        }
      }

      if (input.articleId) {
        const article = await convex.action(api.agents.actions.getArticle, {
          articleId: input.articleId,
        });
        if (article) {
          ctx.articleSummary = {
            id: input.articleId,
            title: article.title,
            hasMarkdown: !!article.contentMarkdown,
            hasHtml: !!article.contentHtml,
            status: article.status || "draft",
          };
        }
      }

      return ctx;
    });

    // Step 4: Plan erstellen mit LLM
    const plan = await step.run("create-plan", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Analyzing request and creating plan",
        progress: 30,
      });

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const skillSummaries = getSkillSummaries();
      const skillSummariesText = Object.entries(skillSummaries)
        .map(([id, summary]) => `- **${id}**: ${summary}`)
        .join("\n");

      const systemPrompt = ROUTER_SYSTEM_PROMPT.replace("{SKILL_SUMMARIES}", skillSummariesText);

      let userPrompt = "";
      
      if (input.userMessage) {
        userPrompt += `**User-Anfrage:** ${input.userMessage}\n\n`;
      }
      
      if (context.briefSummary) {
        userPrompt += `**Content Brief vorhanden:**
- Titel: ${context.briefSummary.title}
- Keyword: ${context.briefSummary.primaryKeyword}
- Status: ${context.briefSummary.status}\n\n`;
      }
      
      if (context.articleSummary) {
        userPrompt += `**Artikel vorhanden:**
- Titel: ${context.articleSummary.title}
- Hat Markdown: ${context.articleSummary.hasMarkdown ? "Ja" : "Nein"}
- Hat HTML: ${context.articleSummary.hasHtml ? "Ja" : "Nein"}
- Status: ${context.articleSummary.status}\n\n`;
      }

      if (input.requestedSkills?.length) {
        userPrompt += `**Explizit angeforderte Skills:** ${input.requestedSkills.join(", ")}\n\n`;
      }

      if (input.excludeSkills?.length) {
        userPrompt += `**Ausgeschlossene Skills:** ${input.excludeSkills.join(", ")}\n\n`;
      }

      userPrompt += "Erstelle einen Ausführungsplan im JSON-Format.";

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Claude");
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from response");
      }

      const parsedPlan: RouterPlan = JSON.parse(jsonMatch[0]);

      for (const planStep of parsedPlan.steps) {
        if (!skillExists(planStep.skillId)) {
          throw new Error(`Unknown skill in plan: ${planStep.skillId}`);
        }
        planStep.requiresThinking = THINKING_SKILLS.includes(planStep.skillId);
      }

      return parsedPlan;
    });

    // Step 5: Plan ausführen (wenn autoExecute)
    let executionResults: Record<string, any> = {};
    
    if (input.autoExecute) {
      executionResults = await step.run("execute-plan", async () => {
        await convex.action(api.agents.actions.updateAgentJob, {
          inngestEventId: event.id || `${Date.now()}`,
          currentStep: "Executing plan",
          progress: 50,
        });

        const results: Record<string, any> = {};
        
        const stepsByOrder = new Map<number, typeof plan.steps>();
        for (const s of plan.steps) {
          const order = s.dependsOn.length === 0 ? 0 : Math.max(...s.dependsOn) + 1;
          if (!stepsByOrder.has(order)) {
            stepsByOrder.set(order, []);
          }
          stepsByOrder.get(order)!.push(s);
        }

        for (const [order, steps] of Array.from(stepsByOrder.entries()).sort((a, b) => a[0] - b[0])) {
          const eventPromises = steps.map(async (s) => {
            const eventName = SKILL_TO_EVENT[s.skillId];
            if (!eventName) {
              results[s.skillId] = { error: "No event mapping for skill" };
              return;
            }

            const eventData: Record<string, any> = {
              projectId,
              userId,
              customerId,
              workspaceId,
              routerJobId: event.id,
            };

            if (input.briefId) eventData.briefId = input.briefId;
            if (input.articleId) eventData.articleId = input.articleId;

            if (s.skillId === "social-post-creator") {
              eventData.platforms = ["linkedin", "twitter", "instagram", "facebook"];
            }

            await inngest.send({
              name: eventName,
              data: eventData,
            });

            results[s.skillId] = { 
              status: "triggered",
              eventName,
              order: s.order,
            };
          });

          await Promise.all(eventPromises);
        }

        return results;
      });
    }

    // Step 6: Finalisieren
    const durationMs = Date.now() - startTime;
    await step.run("finalize", async () => {
      await convex.action(api.agents.actions.logUsage, {
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        jobId: event.id,
        creditsUsed: CREDITS_REQUIRED,
        inputTokens,
        outputTokens,
        status: "completed",
        durationMs,
      });

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "completed",
        progress: 100,
        currentStep: "Done",
        creditsUsed: CREDITS_REQUIRED,
        result: {
          plan,
          executed: input.autoExecute || false,
          executionResults,
        },
      });
    });

    return {
      success: true,
      plan,
      executed: input.autoExecute || false,
      executionResults,
      creditsUsed: CREDITS_REQUIRED,
      durationMs,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
      },
    };
  }
);

export default routerAgent;
