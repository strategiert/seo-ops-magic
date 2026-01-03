#!/usr/bin/env ts-node

/**
 * Publish Article Script
 *
 * Usage:
 *   npm run publish-article -- --article-id <uuid>
 *   npm run publish-article -- --project-id <uuid>
 *   npm run publish-article -- --project-id <uuid> --status approved
 */

import { loadConfig } from '../utils/config';
import { WordPressService } from '../services/WordPressService';
import { LLMService } from '../services/LLMService';
import { SupabaseService } from '../services/SupabaseService';
import { InternalLinker } from '../modules/InternalLinker';
import { WordPressPublisher } from '../modules/WordPressPublisher';

interface ScriptOptions {
  articleId?: string;
  projectId?: string;
  status?: 'publish' | 'draft' | 'pending';
  addLinks?: boolean;
  language?: string;
}

async function main() {
  console.log('=== SEO OPS WORDPRESS PUBLISHER ===\n');

  // Parse command line arguments
  const options = parseArguments();

  // Load configuration
  const config = loadConfig();
  console.log('✓ Configuration loaded');
  console.log(`  WordPress: ${config.wordpress.url}`);
  console.log(`  LLM Provider: ${config.llm.provider}\n`);

  // Initialize services
  const wpService = new WordPressService(
    config.wordpress.url,
    config.wordpress.username,
    config.wordpress.appPassword
  );

  const llmService = new LLMService(
    config.llm.provider,
    config.llm.apiKey,
    config.llm.model
  );

  const supabaseService = new SupabaseService(
    config.supabase.url,
    config.supabase.serviceRoleKey
  );

  const internalLinker = new InternalLinker();
  const publisher = new WordPressPublisher(wpService, llmService, internalLinker);

  // Load articles for internal linking
  console.log('Loading published articles for internal linking...');
  const linkableArticles = await supabaseService.getAllPublishedArticles();
  internalLinker.loadArticles(linkableArticles);
  const stats = internalLinker.getStats();
  console.log(`  Total: ${stats.total} articles`);
  console.log(`  By language:`, stats.byLanguage);
  console.log();

  // Fetch articles to publish
  let articles;
  if (options.articleId) {
    console.log(`Fetching article: ${options.articleId}...\n`);
    const article = await supabaseService.getArticle(options.articleId);
    if (!article) {
      throw new Error(`Article not found: ${options.articleId}`);
    }
    articles = [article];
  } else if (options.projectId) {
    console.log(`Fetching articles for project: ${options.projectId}...\n`);
    articles = await supabaseService.getArticlesByProject(options.projectId, 'approved');
  } else {
    console.log('Fetching all approved articles...\n');
    articles = await supabaseService.getArticlesReadyForPublishing();
  }

  if (articles.length === 0) {
    console.log('No articles to publish.');
    return;
  }

  // Publish articles
  const publishOptions = {
    status: options.status || 'draft',
    addInternalLinks: options.addLinks !== false,
    maxInternalLinks: 5,
    language: options.language || 'de',
  };

  if (articles.length === 1) {
    const postId = await publisher.publishArticle(articles[0], publishOptions);

    // Update Supabase with WordPress post ID
    await supabaseService.updateArticleWordPressId(articles[0].id, postId);
  } else {
    const postIds = await publisher.publishBatch(articles, publishOptions);

    // Update Supabase with WordPress post IDs
    for (let i = 0; i < articles.length; i++) {
      if (postIds[i]) {
        await supabaseService.updateArticleWordPressId(articles[i].id, postIds[i]);
      }
    }
  }

  console.log('\n✓ DONE\n');
}

function parseArguments(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--article-id':
        options.articleId = args[++i];
        break;
      case '--project-id':
        options.projectId = args[++i];
        break;
      case '--status':
        options.status = args[++i] as any;
        break;
      case '--no-links':
        options.addLinks = false;
        break;
      case '--language':
      case '--lang':
        options.language = args[++i];
        break;
    }
  }

  return options;
}

// Run the script
main().catch((error) => {
  console.error('\n✗ ERROR:', error.message);
  process.exit(1);
});
