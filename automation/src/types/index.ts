// Article data from Supabase
export interface Article {
  id: string;
  project_id: string;
  brief_id: string | null;
  title: string;
  primary_keyword: string | null;
  content_markdown: string | null;
  content_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  outline_json: any;
  faq_json: FAQ[] | null;
  status: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

// WordPress Post Types
export interface WordPressPost {
  id?: number;
  title: string;
  content: string;
  status: 'publish' | 'draft' | 'pending' | 'private';
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  acf?: {
    custom_html_content?: string;
    [key: string]: any;
  };
  lang?: string; // For Polylang
  translations?: { [lang: string]: number }; // For Polylang
}

export interface WordPressPostResponse {
  id: number;
  link: string;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  status: string;
}

// Internal Link Structure
export interface InternalLink {
  keyword: string;
  targetSlug: string;
  targetTitle: string;
  targetUrl: string;
  language: string;
}

export interface LinkableArticle {
  id: string;
  title: string;
  slug: string;
  primaryKeyword: string;
  language: string;
  wpPostId?: number;
}

// LLM Service Types
export interface DesignWrapperOptions {
  brand?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    headingFont?: string;
    bodyFont?: string;
  };
  includeHero?: boolean;
  includeCTA?: boolean;
  ctaText?: string;
  ctaLink?: string;
}

export interface TranslationRequest {
  content: string;
  fromLanguage: string;
  toLanguage: string;
  contentType: 'article' | 'faq' | 'meta';
}

// Configuration
export interface AutomationConfig {
  wordpress: {
    url: string;
    username: string;
    appPassword: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  llm: {
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model?: string;
  };
  multilingual: {
    defaultLanguage: string;
    supportedLanguages: string[];
  };
}
