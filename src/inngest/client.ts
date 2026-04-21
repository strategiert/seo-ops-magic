import { Inngest } from "inngest";

/**
 * Inngest Client for SEO Content Ops
 *
 * This client is used to:
 * 1. Define event types for type-safety
 * 2. Send events from Convex/Frontend
 * 3. Create agent functions
 */

// Event type definitions for all our agents
export type Events = {
  // ============ ROUTER EVENTS ============
  
  /**
   * Main entry point: Route a user request to appropriate agents
   */
  "agent/route": {
    data: {
      workspaceId: string;
      projectId: string;
      userId: string;
      customerId: string;
      input: {
        userMessage?: string;
        briefId?: string;
        articleId?: string;
        requestedSkills?: string[];
        excludeSkills?: string[];
        autoExecute?: boolean;
      };
    };
  };

  /**
   * Direct skill execution (bypasses router)
   */
  "agent/execute-skill": {
    data: {
      workspaceId: string;
      projectId: string;
      userId: string;
      customerId: string;
      skillId: string;
      skillInput: Record<string, any>;
      routerJobId?: string; // If triggered by router
    };
  };

  // ============ CONTENT CREATION EVENTS ============
  
  "article/generate": {
    data: {
      briefId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };
  
  "article/published": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      title: string;
      contentMarkdown: string;
      primaryKeyword: string;
    };
  };
  
  "article/transform-html": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };
  
  "article/publish-wordpress": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      status?: "draft" | "publish";
      routerJobId?: string;
    };
  };

  "article/analyze-links": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };

  // ============ CONTENT TRANSFORMATION EVENTS ============

  "content/generate-social-posts": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      platforms: ("linkedin" | "twitter" | "instagram" | "facebook")[];
      routerJobId?: string;
    };
  };
  
  "content/generate-press-release": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };
  
  "content/generate-ad-copies": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      platforms: ("google" | "meta" | "linkedin")[];
      routerJobId?: string;
    };
  };
  
  "content/generate-newsletter": {
    data: {
      articleIds: string[];
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };

  "content/translate": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      targetLanguage: "de" | "en";
      routerJobId?: string;
    };
  };

  // ============ VISUAL ASSET EVENTS ============

  "asset/generate-images": {
    data: {
      contentAssetId?: string;
      articleId?: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      routerJobId?: string;
    };
  };

  // ============ WORKFLOW EVENTS (Multi-Agent) ============
  
  "workflow/full-content-pipeline": {
    data: {
      briefId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      options: {
        generateSocialPosts: boolean;
        generatePressRelease: boolean;
        generateAdCopies: boolean;
        publishToWordPress: boolean;
      };
    };
  };

  /**
   * Callback when a skill completes (for router tracking)
   */
  "workflow/skill-completed": {
    data: {
      routerJobId: string;
      skillId: string;
      success: boolean;
      result?: any;
      error?: string;
    };
  };
};

// Create the Inngest client
export const inngest = new Inngest({
  id: "seo-content-ops",
  schemas: new Map() as any,
});

// Cost estimates per agent (in credits)
export const AGENT_COSTS = {
  "router": 2,              // Routing logic only
  "seo-writer": 10,         // Long content generation
  "html-designer": 3,       // Transformation
  "wp-publisher": 1,        // API call only
  "internal-linker": 5,     // Analysis + update
  "social-creator": 5,      // Multiple posts
  "ad-copy-writer": 4,      // Multiple variants
  "press-release": 6,       // Structured content
  "newsletter": 5,          // Compilation
  "image-generator": 8,     // External API (DALL-E/Midjourney)
  "video-creator": 10,      // Complex generation
  "carousel-designer": 6,   // Multi-slide
  "press-outreach": 4,      // Research
  "link-building": 4,       // Research
  "editorial-researcher": 3, // Research
  "content-translator": 7,  // Full translation
  "company-social": 3,      // Planning
  "employee-advocacy": 3,   // Adaptation
  "linkbait-creator": 6,    // Creative content
} as const;

export type AgentId = keyof typeof AGENT_COSTS;

// Skill classification for router
export const THINKING_SKILLS = [
  "seo-writer",
  "social-creator",
  "ad-copy-writer",
  "press-release",
  "newsletter",
  "content-translator",
  "image-generator",
  "linkbait-creator",
] as const;

export const DETERMINISTIC_SKILLS = [
  "wp-publisher",
  "internal-linker",
  "html-designer",
] as const;
