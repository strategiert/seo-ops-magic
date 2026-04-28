"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * NeuronWriter API Actions
 *
 * Proxy to NeuronWriter API for SEO content evaluation and research.
 * Converted from supabase/functions/neuronwriter-api/index.ts
 */

const NW_BASE_URL = "https://app.neuronwriter.com/neuron-api/0.5/writer";

/**
 * Validate that an API key was provided (must come from project settings)
 */
function requireApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error("NeuronWriter API Key nicht konfiguriert. Bitte in den Projekt-Einstellungen eingeben.");
  }
  return apiKey;
}

/**
 * Call NeuronWriter with built-in retry for transient failures.
 *
 * NeuronWriter routinely returns 5xx (or just times out the connection)
 * while a query is still being analysed. Without a server-side retry,
 * that bubbles all the way to the browser as a Convex "Server Error" and
 * users see analysis aborts mid-poll. We retry up to 3 times with
 * short backoff for 5xx and network errors. 4xx (real failures, bad
 * keys, missing query) are returned immediately so callers get the
 * real message instead of waiting through bogus retries.
 */
async function nwFetchWithRetry(
  endpoint: string,
  apiKey: string,
  body: Record<string, any>
): Promise<any> {
  const maxAttempts = 3;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${NW_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return await response.json();
      }

      // 4xx: terminal — surface immediately, don't waste retries
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
      }

      // 5xx: transient, fall through to retry
      lastErr = new Error(`NeuronWriter API ${response.status}`);
    } catch (err) {
      // Network errors, fetch aborts, JSON parse failures — treat as transient
      lastErr = err;
    }

    if (attempt < maxAttempts) {
      // 400ms, 1200ms exponential-ish backoff
      const delayMs = 400 * Math.pow(3, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("NeuronWriter API: unbekannter Fehler nach mehreren Versuchen");
}

/**
 * List all NeuronWriter projects
 */
export const listProjects = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, { apiKey }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);
    return await nwFetchWithRetry("/list-projects", validApiKey, {});
  },
});

/**
 * List queries in a NeuronWriter project
 */
export const listQueries = action({
  args: {
    apiKey: v.string(),
    projectId: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { apiKey, projectId, status, tags }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);

    const requestBody: Record<string, any> = {
      project: projectId,
    };
    if (status) requestBody.status = status;
    if (tags) requestBody.tags = tags;

    return await nwFetchWithRetry("/list-queries", validApiKey, requestBody);
  },
});

/**
 * Create a new keyword query in NeuronWriter
 */
export const newQuery = action({
  args: {
    apiKey: v.string(),
    projectId: v.string(),
    keyword: v.string(),
    language: v.string(),
    engine: v.string(),
  },
  handler: async (ctx, { apiKey, projectId, keyword, language, engine }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);
    return await nwFetchWithRetry("/new-query", validApiKey, {
      project: projectId,
      keyword,
      language,
      engine,
    });
  },
});

/**
 * Get a specific query's details
 */
export const getQuery = action({
  args: {
    apiKey: v.string(),
    queryId: v.string(),
  },
  handler: async (ctx, { apiKey, queryId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);
    return await nwFetchWithRetry("/get-query", validApiKey, { query: queryId });
  },
});

/**
 * Get content suggestions for a query
 */
export const getContent = action({
  args: {
    apiKey: v.string(),
    queryId: v.string(),
  },
  handler: async (ctx, { apiKey, queryId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);
    return await nwFetchWithRetry("/get-content", validApiKey, { query: queryId });
  },
});

/**
 * Evaluate HTML content against a keyword query
 * Returns SEO score and recommendations
 */
export const evaluateContent = action({
  args: {
    apiKey: v.string(),
    queryId: v.string(),
    html: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { apiKey, queryId, html, title, description }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(apiKey);

    const requestBody: Record<string, any> = {
      query: queryId,
      html,
    };
    if (title) requestBody.title = title;
    if (description) requestBody.description = description;

    return await nwFetchWithRetry("/evaluate-content", validApiKey, requestBody);
  },
});

/**
 * Generic action that mirrors the original Edge Function interface
 * for backwards compatibility during migration
 */
export const call = action({
  args: {
    apiKey: v.string(),
    action: v.string(),
    projectId: v.optional(v.string()),
    queryId: v.optional(v.string()),
    keyword: v.optional(v.string()),
    language: v.optional(v.string()),
    engine: v.optional(v.string()),
    html: v.optional(v.string()),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const validApiKey = requireApiKey(args.apiKey);

    let endpoint: string;
    let requestBody: Record<string, any> = {};

    switch (args.action) {
      case "list-projects":
        endpoint = "/list-projects";
        break;

      case "list-queries":
        if (!args.projectId) {
          throw new Error("projectId required for list-queries");
        }
        endpoint = "/list-queries";
        requestBody = {
          project: args.projectId,
          ...(args.status && { status: args.status }),
          ...(args.tags && { tags: args.tags }),
        };
        break;

      case "new-query":
        if (!args.projectId || !args.keyword || !args.language || !args.engine) {
          throw new Error("projectId, keyword, language, and engine required for new-query");
        }
        endpoint = "/new-query";
        requestBody = {
          project: args.projectId,
          keyword: args.keyword,
          language: args.language,
          engine: args.engine,
        };
        break;

      case "get-query":
        if (!args.queryId) {
          throw new Error("queryId required for get-query");
        }
        endpoint = "/get-query";
        requestBody = { query: args.queryId };
        break;

      case "get-content":
        if (!args.queryId) {
          throw new Error("queryId required for get-content");
        }
        endpoint = "/get-content";
        requestBody = { query: args.queryId };
        break;

      case "evaluate-content":
        const htmlContent = args.html || args.content;
        if (!args.queryId || !htmlContent) {
          throw new Error("queryId and html required for evaluate-content");
        }
        endpoint = "/evaluate-content";
        requestBody = {
          query: args.queryId,
          html: htmlContent,
          ...(args.title && { title: args.title }),
          ...(args.description && { description: args.description }),
        };
        break;

      default:
        throw new Error(`Unknown action: ${args.action}`);
    }

    return await nwFetchWithRetry(endpoint, validApiKey, requestBody);
  },
});
