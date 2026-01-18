"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * WordPress Actions
 *
 * Handles publishing articles to WordPress and fetching taxonomies.
 * Converted from supabase/functions/wordpress-publish and wordpress-taxonomies
 */

type PublishStatus = "draft" | "publish";

/**
 * Publish an article to WordPress
 *
 * Migrated from: supabase/functions/wordpress-publish/index.ts
 */
export const publishArticle = action({
  args: {
    articleId: v.id("articles"),
    status: v.optional(v.string()), // 'draft' | 'publish'
    categoryIds: v.optional(v.array(v.number())),
    tagIds: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    wpPostId?: number;
    wpUrl?: string;
    status?: string;
    error?: string;
  }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }
    const userId = identity.subject;

    const { articleId, status = "draft", categoryIds = [], tagIds = [] } = args;

    // Fetch article
    const article = await ctx.runQuery(api.tables.articles.get, { id: articleId });
    if (!article) {
      return { success: false, error: "Article not found" };
    }

    // Fetch project
    const project = await ctx.runQuery(api.tables.projects.get, { id: article.projectId });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Project access is verified in the query, but double-check
    if (!project.wpUrl) {
      return { success: false, error: "WordPress URL not configured" };
    }

    // Fetch WordPress integration
    const integrations = await ctx.runQuery(api.tables.integrations.getByProjectType, {
      projectId: article.projectId,
      type: "wordpress",
    });

    const integration = integrations[0];
    if (!integration?.wpUsername || !integration?.wpAppPassword) {
      return { success: false, error: "WordPress not configured" };
    }

    // Get HTML export if available
    const htmlExports = await ctx.runQuery(api.tables.htmlExports.getByArticle, {
      articleId: articleId,
    });

    // Determine content to publish
    let content = "";
    if (htmlExports.length > 0 && htmlExports[0].htmlContent) {
      // Use the most recent HTML export
      const htmlContent = htmlExports[0].htmlContent;

      // Extract content from the wrapper
      // Note: In Node.js, we'd use a proper HTML parser like cheerio or jsdom
      // For now, we'll do simple extraction or use the full content
      if (htmlContent.includes('id="seo-ops-content-wrapper"')) {
        // Try to extract just the wrapper content
        const startMarker = '<div id="seo-ops-content-wrapper"';
        const startIdx = htmlContent.indexOf(startMarker);
        if (startIdx !== -1) {
          // Find the matching closing div (simplified approach)
          const endIdx = htmlContent.lastIndexOf("</div>");
          if (endIdx > startIdx) {
            content = htmlContent.substring(startIdx, endIdx + 6);
          } else {
            content = htmlContent;
          }
        } else {
          content = htmlContent;
        }
      } else {
        content = htmlContent;
      }
    } else if (article.contentHtml) {
      content = article.contentHtml;
    } else if (article.contentMarkdown) {
      content = article.contentMarkdown;
    } else {
      return {
        success: false,
        error: "No content available. Please generate HTML export first.",
      };
    }

    // Send to WordPress
    const baseUrl = project.wpUrl.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wpUsername}:${integration.wpAppPassword}`);
    const wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const wpPost = {
      title: article.title,
      content,
      status: status as PublishStatus,
      categories: categoryIds,
      tags: tagIds,
    };

    try {
      const wpResponse = await fetch(wpEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wpPost),
      });

      const wpResponseText = await wpResponse.text();

      if (!wpResponse.ok) {
        console.error("WordPress error:", wpResponse.status, wpResponseText);
        return {
          success: false,
          error: `WordPress error: ${wpResponse.status}`,
        };
      }

      let wpData: any;
      try {
        wpData = JSON.parse(wpResponseText);
      } catch {
        wpData = {};
      }

      // Update article with WordPress post ID
      if (wpData?.id) {
        await ctx.runMutation(api.tables.articles.update, {
          id: articleId,
          wpPostId: wpData.id,
          status: status === "publish" ? "published" : article.status,
        });
      }

      return {
        success: true,
        wpPostId: wpData?.id,
        wpUrl: wpData?.link,
        status: wpData?.status,
      };
    } catch (error) {
      console.error("Error publishing to WordPress:", error);
      return {
        success: false,
        error: "Failed to connect to WordPress",
      };
    }
  },
});

/**
 * Fetch WordPress taxonomies (categories and tags)
 *
 * Migrated from: supabase/functions/wordpress-taxonomies/index.ts
 */
export const fetchTaxonomies = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{
    categories: Array<{ id: number; name: string; slug: string }>;
    tags: Array<{ id: number; name: string; slug: string }>;
    error?: string;
  }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { categories: [], tags: [], error: "Unauthorized" };
    }

    // Fetch project
    const project = await ctx.runQuery(api.tables.projects.get, { id: projectId });
    if (!project) {
      return { categories: [], tags: [], error: "Project not found" };
    }

    if (!project.wpUrl) {
      return { categories: [], tags: [], error: "WordPress URL not configured" };
    }

    // Fetch WordPress integration
    const integrations = await ctx.runQuery(api.tables.integrations.getByProjectType, {
      projectId,
      type: "wordpress",
    });

    const integration = integrations[0];
    if (!integration?.wpUsername || !integration?.wpAppPassword) {
      return { categories: [], tags: [], error: "WordPress not configured" };
    }

    const baseUrl = project.wpUrl.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wpUsername}:${integration.wpAppPassword}`);

    try {
      // Fetch categories and tags in parallel
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
          headers: { Authorization: `Basic ${authString}` },
        }),
        fetch(`${baseUrl}/wp-json/wp/v2/tags?per_page=100`, {
          headers: { Authorization: `Basic ${authString}` },
        }),
      ]);

      const categories = categoriesRes.ok
        ? (await categoriesRes.json()).map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          }))
        : [];

      const tags = tagsRes.ok
        ? (await tagsRes.json()).map((t: any) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
          }))
        : [];

      return { categories, tags };
    } catch (error) {
      console.error("Error fetching taxonomies:", error);
      return {
        categories: [],
        tags: [],
        error: "Failed to connect to WordPress",
      };
    }
  },
});
