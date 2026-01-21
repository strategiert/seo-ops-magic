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
  // Content Creation Events
  "article/generate": {
    data: {
      briefId: string;
      projectId: string;
      userId: string;
      customerId: string; // For concurrency control
    };
  };
  "article/published": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
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
    };
  };
  "article/publish-wordpress": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
    };
  };

  // Repurposing Events
  "content/generate-social-posts": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      platforms: ("linkedin" | "twitter" | "instagram" | "facebook")[];
    };
  };
  "content/generate-press-release": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
    };
  };
  "content/generate-ad-copies": {
    data: {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      platforms: ("google" | "meta" | "linkedin")[];
    };
  };
  "content/generate-newsletter": {
    data: {
      articleIds: string[];
      projectId: string;
      userId: string;
      customerId: string;
    };
  };

  // Visual Asset Events
  "asset/generate-images": {
    data: {
      contentAssetId: string;
      projectId: string;
      userId: string;
      customerId: string;
    };
  };

  // Workflow Events (Multi-Agent)
  "workflow/full-content-pipeline": {
    data: {
      briefId: string;
      projectId: string;
      userId: string;
      customerId: string;
      options: {
        generateSocialPosts: boolean;
        generatePressRelease: boolean;
        generateAdCopies: boolean;
        publishToWordPress: boolean;
      };
    };
  };
};

// Create the Inngest client
export const inngest = new Inngest({
  id: "seo-content-ops",
  schemas: new Map() as any, // Type assertion for events
});

// Cost estimates per agent (in credits)
export const AGENT_COSTS = {
  "seo-writer": 10,        // Long content generation
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
