import { WordPressService } from '../services/WordPressService';
import { LLMService } from '../services/LLMService';
import { InternalLinker } from './InternalLinker';
import { Article, WordPressPost, DesignWrapperOptions } from '../types';

export interface PublishOptions {
  status?: 'publish' | 'draft' | 'pending';
  addInternalLinks?: boolean;
  maxInternalLinks?: number;
  designOptions?: DesignWrapperOptions;
  language?: string;
  categoryIds?: number[];
  tagIds?: number[];
}

export class WordPressPublisher {
  constructor(
    private wpService: WordPressService,
    private llmService: LLMService,
    private internalLinker: InternalLinker
  ) {}

  /**
   * Publish an article to WordPress
   */
  async publishArticle(article: Article, options: PublishOptions = {}): Promise<number> {
    console.log(`\n=== PUBLISHING ARTICLE TO WORDPRESS ===`);
    console.log(`Title: ${article.title}`);
    console.log(`Language: ${options.language || 'de'}`);
    console.log(`Status: ${options.status || 'draft'}`);

    // Step 1: Generate beautiful HTML with Tailwind
    console.log('\n[1/4] Generating Tailwind HTML design...');
    const html = await this.llmService.wrapInTailwindDesign(
      article.title,
      article.content_markdown || '',
      article.faq_json || [],
      options.designOptions
    );

    // Step 2: Add internal links (optional)
    let finalHtml = html;
    if (options.addInternalLinks) {
      console.log('\n[2/4] Adding internal links...');
      const links = this.internalLinker.findInternalLinks(
        html,
        article.id,
        options.language || 'de',
        options.maxInternalLinks || 5
      );
      finalHtml = this.internalLinker.insertLinksIntoHTML(html, links);
    } else {
      console.log('\n[2/4] Skipping internal links');
    }

    // Step 3: Create slug from title or primary keyword
    console.log('\n[3/4] Preparing WordPress post data...');
    const slug = this.createSlug(article.primary_keyword || article.title);

    // Step 4: Publish to WordPress
    console.log('\n[4/4] Publishing to WordPress...');
    const wpPost: WordPressPost = {
      title: article.title,
      content: '', // Main content field stays empty or minimal
      status: options.status || 'draft',
      slug,
      categories: options.categoryIds,
      tags: options.tagIds,
      acf: {
        custom_html_content: finalHtml, // Store HTML in ACF field
      },
      lang: options.language || 'de',
    };

    // Check if post already exists by slug
    const existingPost = await this.wpService.getPostBySlug(slug);

    let postId: number;
    if (existingPost) {
      console.log(`  → Post exists (ID: ${existingPost.id}), updating...`);
      const updated = await this.wpService.updatePost(existingPost.id, wpPost);
      postId = updated.id;
    } else {
      console.log('  → Creating new post...');
      const created = await this.wpService.createPost(wpPost);
      postId = created.id;
    }

    console.log(`\n✓ PUBLISHED: Post ID ${postId}`);
    console.log(`  URL: ${await this.getPostUrl(postId)}`);
    console.log(`  Slug: ${slug}`);

    return postId;
  }

  /**
   * Publish translated version of an article
   */
  async publishTranslatedArticle(
    article: Article,
    toLanguage: string,
    originalPostId: number,
    options: PublishOptions = {}
  ): Promise<number> {
    console.log(`\n=== TRANSLATING & PUBLISHING (${toLanguage}) ===`);

    // Translate content
    const translatedMarkdown = await this.llmService.translateContent({
      content: article.content_markdown || '',
      fromLanguage: 'de',
      toLanguage,
      contentType: 'article',
    });

    const translatedTitle = await this.llmService.translateContent({
      content: article.title,
      fromLanguage: 'de',
      toLanguage,
      contentType: 'meta',
    });

    // Create translated article object
    const translatedArticle: Article = {
      ...article,
      title: translatedTitle,
      content_markdown: translatedMarkdown,
    };

    // Publish with language settings
    const postId = await this.publishArticle(translatedArticle, {
      ...options,
      language: toLanguage,
    });

    // Link translation to original (for Polylang)
    console.log(`\n  → Linking translation to original post ${originalPostId}...`);
    // Note: Polylang API integration would go here
    // This requires additional Polylang REST API endpoints

    return postId;
  }

  /**
   * Batch publish multiple articles with parallel processing and concurrency control
   */
  async publishBatch(articles: Article[], options: PublishOptions = {}): Promise<number[]> {
    console.log(`\n=== BATCH PUBLISHING ${articles.length} ARTICLES (PARALLEL) ===\n`);

    const concurrencyLimit = 3; // Process 3 articles at a time to avoid overwhelming the server
    const postIds: number[] = [];
    const errors: Array<{ article: Article; error: any }> = [];

    // Process articles in batches with concurrency limit
    for (let i = 0; i < articles.length; i += concurrencyLimit) {
      const batch = articles.slice(i, i + concurrencyLimit);
      console.log(`\n--- Processing batch ${Math.floor(i / concurrencyLimit) + 1} (articles ${i + 1}-${Math.min(i + concurrencyLimit, articles.length)}) ---`);

      const batchPromises = batch.map(async (article, batchIndex) => {
        const articleNumber = i + batchIndex + 1;
        try {
          console.log(`  [${articleNumber}/${articles.length}] Publishing: ${article.title}`);
          const postId = await this.publishArticle(article, options);
          console.log(`  [${articleNumber}/${articles.length}] ✓ Success: Post ID ${postId}`);
          return { success: true, postId, article };
        } catch (error) {
          console.error(`  [${articleNumber}/${articles.length}] ✗ Failed: ${article.title}`, error);
          return { success: false, error, article };
        }
      });

      // Wait for all promises in this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            postIds.push(result.value.postId);
          } else {
            errors.push({ article: result.value.article, error: result.value.error });
          }
        } else {
          // Promise was rejected (shouldn't happen with our try/catch, but handle anyway)
          console.error('  ✗ Unexpected batch promise rejection:', result.reason);
        }
      });

      // Small delay between batches to avoid rate limiting
      if (i + concurrencyLimit < articles.length) {
        await this.delay(500);
      }
    }

    console.log(`\n✓ BATCH COMPLETE: ${postIds.length}/${articles.length} published successfully`);
    if (errors.length > 0) {
      console.log(`✗ ${errors.length} articles failed to publish`);
      errors.forEach(({ article, error }) => {
        console.log(`  - ${article.title}: ${error.message || error}`);
      });
    }

    return postIds;
  }

  /**
   * Create URL-friendly slug
   */
  private createSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get full URL for a post
   */
  private async getPostUrl(postId: number): Promise<string> {
    const post = await this.wpService.getPost(postId);
    return post.link;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
