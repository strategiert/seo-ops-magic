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

    const response = await fetch(`${NW_BASE_URL}/list-projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}/list-queries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}/new-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify({
        project: projectId,
        keyword,
        language,
        engine,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}/get-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify({ query: queryId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}/get-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify({ query: queryId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}/evaluate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
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

    const response = await fetch(`${NW_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": validApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `NeuronWriter API error: ${response.status}`);
    }

    return await response.json();
  },
});
