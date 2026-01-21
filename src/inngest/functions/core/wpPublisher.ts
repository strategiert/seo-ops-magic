import { inngest } from "../../client";
import { convex, api, AGENT_CREDITS } from "../../lib/convex";

/**
 * WordPress Publisher Agent
 *
 * Publishes articles to WordPress via REST API.
 * Handles meta fields, categories, tags, and featured images.
 *
 * Input: Article ID
 * Output: WordPress Post ID and URL
 *
 * Cost: 1 credit (API call only, no LLM)
 */

const AGENT_ID = "wp-publisher";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

export const wordpressPublisher = inngest.createFunction(
  {
    id: "wordpress-publisher",
    name: "WordPress Publisher",
    concurrency: {
      limit: 2, // Limit to avoid WordPress rate limits
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "article/publish-wordpress" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId, workspaceId, status = "draft" } = event.data as {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      status?: "draft" | "publish";
    };

    const startTime = Date.now();

    // Step 1: Check and reserve credits
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

    // Step 2: Create job record
    await step.run("create-job-record", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "article/publish-wordpress",
        inputData: { articleId, status },
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    // Step 3: Fetch article with WordPress config
    const data = await step.run("fetch-data", async () => {
      const article = await convex.action(api.agents.actions.getArticle, {
        articleId,
      });

      if (!article) {
        throw new Error(`Article not found: ${articleId}`);
      }

      if (!article.project?.wpUrl) {
        throw new Error("WordPress URL not configured for this project");
      }

      if (!article.wpIntegration?.wpUsername || !article.wpIntegration?.wpAppPassword) {
        throw new Error("WordPress credentials not configured");
      }

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Preparing WordPress publish",
        progress: 20,
      });

      return article;
    });

    // Step 4: Publish to WordPress
    const wpResult = await step.run("publish-to-wordpress", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Publishing to WordPress",
        progress: 50,
      });

      const wpUrl = data.project!.wpUrl!;
      const { wpUsername, wpAppPassword } = data.wpIntegration!;

      // Use HTML content if available, otherwise markdown
      const content = data.contentHtml || data.contentMarkdown || "";

      // Build WordPress post payload
      const postPayload: Record<string, any> = {
        title: data.title,
        content: content,
        status: status,
      };

      // Add Yoast SEO meta if available
      if (data.metaTitle || data.metaDescription) {
        postPayload.meta = {
          _yoast_wpseo_title: data.metaTitle || data.title,
          _yoast_wpseo_metadesc: data.metaDescription || "",
        };
      }

      // Make WordPress REST API request
      const apiUrl = `${wpUrl.replace(/\/$/, "")}/wp/v2/posts`;
      const authHeader = `Basic ${Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64")}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(postPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WordPress API error: ${response.status} - ${errorText}`);
      }

      const wpPost = await response.json();

      return {
        wpPostId: wpPost.id as number,
        wpUrl: wpPost.link as string,
        wpStatus: wpPost.status as string,
      };
    });

    // Step 5: Update article with WordPress ID
    await step.run("update-article", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Updating article record",
        progress: 80,
      });

      await convex.action(api.agents.actions.updateArticle, {
        articleId,
        wpPostId: wpResult.wpPostId,
        status: status === "publish" ? "published" : "draft",
      });
    });

    // Step 6: Log usage
    const durationMs = Date.now() - startTime;
    await step.run("log-usage", async () => {
      await convex.action(api.agents.actions.logUsage, {
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        jobId: event.id,
        creditsUsed: CREDITS_REQUIRED,
        articleId,
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
          wpPostId: wpResult.wpPostId,
          wpUrl: wpResult.wpUrl,
        },
      });
    });

    return {
      success: true,
      articleId,
      wpPostId: wpResult.wpPostId,
      wpUrl: wpResult.wpUrl,
      wpStatus: wpResult.wpStatus,
      creditsUsed: CREDITS_REQUIRED,
      durationMs,
    };
  }
);
