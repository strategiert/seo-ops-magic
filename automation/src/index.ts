/**
 * SEO Ops Magic - WordPress Automation
 *
 * Main entry point for programmatic usage
 */

export { WordPressService } from './services/WordPressService';
export { LLMService } from './services/LLMService';
export { SupabaseService } from './services/SupabaseService';
export { InternalLinker } from './modules/InternalLinker';
export { WordPressPublisher } from './modules/WordPressPublisher';
export { loadConfig } from './utils/config';

export * from './types';

// Example usage:
/*
import { loadConfig, WordPressService, LLMService, SupabaseService, InternalLinker, WordPressPublisher } from './index';

async function publishMyArticle() {
  const config = loadConfig();

  const wpService = new WordPressService(
    config.wordpress.url,
    config.wordpress.username,
    config.wordpress.appPassword
  );

  const llmService = new LLMService(config.llm.provider, config.llm.apiKey);
  const supabaseService = new SupabaseService(config.supabase.url, config.supabase.serviceRoleKey);
  const internalLinker = new InternalLinker();
  const publisher = new WordPressPublisher(wpService, llmService, internalLinker);

  // Load articles for internal linking
  const linkableArticles = await supabaseService.getAllPublishedArticles();
  internalLinker.loadArticles(linkableArticles);

  // Publish an article
  const article = await supabaseService.getArticle('article-uuid');
  const postId = await publisher.publishArticle(article, {
    status: 'publish',
    addInternalLinks: true,
    language: 'de',
  });

  console.log(`Published! WordPress Post ID: ${postId}`);
}
*/
