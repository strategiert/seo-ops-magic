import { inngest } from "../client";

/**
 * Full Content Pipeline Workflow
 *
 * Orchestrates the complete content creation and distribution pipeline:
 * 1. Generate SEO article from brief
 * 2. Transform to styled HTML
 * 3. Publish to WordPress (optional)
 * 4. Generate social posts (optional)
 * 5. Generate press release (optional)
 * 6. Generate ad copies (optional)
 *
 * This workflow demonstrates Inngest's step function capabilities
 * for complex multi-agent orchestration.
 */

export const fullContentPipeline = inngest.createFunction(
  {
    id: "full-content-pipeline",
    name: "Full Content Pipeline",
    concurrency: {
      limit: 2, // Only 2 full pipelines per customer at a time
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "workflow/full-content-pipeline" },
  async ({ event, step }) => {
    const { briefId, projectId, userId, customerId, options } = event.data;

    const results: Record<string, any> = {
      briefId,
      startedAt: new Date().toISOString(),
      steps: {},
    };

    // Step 1: Generate SEO Article
    const articleResult = await step.invoke("generate-article", {
      function: inngest.createFunction(
        { id: "temp", name: "temp" },
        { event: "article/generate" },
        async () => ({})
      ),
      data: {
        briefId,
        projectId,
        userId,
        customerId,
      },
    }).catch(() => null);

    // For now, use step.run until we have proper function references
    const article = await step.run("generate-article-step", async () => {
      // This would normally call the seoContentWriter function
      // For demo purposes, we simulate the result
      console.log("Generating article from brief:", briefId);
      return {
        success: true,
        articleId: "generated-article-id",
        title: "Generated Article Title",
      };
    });

    results.steps.articleGeneration = article;

    if (!article.success) {
      return { success: false, error: "Article generation failed", results };
    }

    // Step 2: Transform to HTML
    const html = await step.run("transform-html-step", async () => {
      console.log("Transforming article to HTML:", article.articleId);
      return {
        success: true,
        articleId: article.articleId,
      };
    });

    results.steps.htmlTransformation = html;

    // Step 3: Publish to WordPress (if enabled)
    if (options.publishToWordPress) {
      const wpResult = await step.run("publish-wordpress-step", async () => {
        console.log("Publishing to WordPress:", article.articleId);
        return {
          success: true,
          wpPostId: 12345,
          wpUrl: "https://example.com/article",
        };
      });

      results.steps.wordpressPublish = wpResult;
    }

    // Step 4: Generate Social Posts (if enabled)
    if (options.generateSocialPosts) {
      const socialResult = await step.run("generate-social-posts-step", async () => {
        console.log("Generating social posts for:", article.articleId);
        return {
          success: true,
          postsCreated: 8,
          platforms: ["linkedin", "twitter", "instagram", "facebook"],
        };
      });

      results.steps.socialPosts = socialResult;
    }

    // Step 5: Generate Press Release (if enabled)
    if (options.generatePressRelease) {
      const prResult = await step.run("generate-press-release-step", async () => {
        console.log("Generating press release for:", article.articleId);
        return {
          success: true,
          headline: "Press Release Headline",
        };
      });

      results.steps.pressRelease = prResult;
    }

    // Step 6: Generate Ad Copies (if enabled)
    if (options.generateAdCopies) {
      const adResult = await step.run("generate-ad-copies-step", async () => {
        console.log("Generating ad copies for:", article.articleId);
        return {
          success: true,
          platforms: ["google", "meta", "linkedin"],
        };
      });

      results.steps.adCopies = adResult;
    }

    // Calculate total credits used
    const totalCredits = await step.run("calculate-credits", async () => {
      let total = 10; // Base: SEO Writer
      total += 3; // HTML Designer
      if (options.publishToWordPress) total += 1;
      if (options.generateSocialPosts) total += 5;
      if (options.generatePressRelease) total += 6;
      if (options.generateAdCopies) total += 4;
      return total;
    });

    results.totalCreditsUsed = totalCredits;
    results.completedAt = new Date().toISOString();

    // Send completion notification
    await step.run("send-notification", async () => {
      // TODO: Send email/notification via Convex
      console.log("Pipeline completed for brief:", briefId);
      console.log("Total credits used:", totalCredits);
    });

    return {
      success: true,
      results,
    };
  }
);
