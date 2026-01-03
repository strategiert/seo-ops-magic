import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article, LinkableArticle } from '../types';

export class SupabaseService {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get article by ID
   */
  async getArticle(articleId: string): Promise<Article | null> {
    const { data, error } = await this.client
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to fetch article: ${error.message}`);
    }

    return data as Article;
  }

  /**
   * Get all articles for a project
   */
  async getArticlesByProject(projectId: string, status?: string): Promise<Article[]> {
    let query = this.client.from('articles').select('*').eq('project_id', projectId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }

    console.log(`✓ Fetched ${data.length} articles from Supabase`);
    return data as Article[];
  }

  /**
   * Get all published articles (for internal linking)
   */
  async getAllPublishedArticles(): Promise<LinkableArticle[]> {
    const { data, error } = await this.client
      .from('articles')
      .select('id, title, primary_keyword')
      .eq('status', 'published');

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to fetch published articles: ${error.message}`);
    }

    const articles: LinkableArticle[] = (data as any[]).map((article) => ({
      id: article.id,
      title: article.title,
      slug: this.createSlug(article.primary_keyword || article.title),
      primaryKeyword: article.primary_keyword || article.title,
      language: 'de', // Default, could be extended with language field
    }));

    console.log(`✓ Fetched ${articles.length} published articles for internal linking`);
    return articles;
  }

  /**
   * Update article with WordPress post ID
   */
  async updateArticleWordPressId(articleId: string, wpPostId: number): Promise<void> {
    // Note: This requires adding a wp_post_id column to the articles table
    const { error } = await this.client
      .from('articles')
      .update({ wp_post_id: wpPostId })
      .eq('id', articleId);

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to update article WordPress ID: ${error.message}`);
    }

    console.log(`✓ Updated article ${articleId} with WordPress post ID ${wpPostId}`);
  }

  /**
   * Get articles ready for publishing (approved status)
   */
  async getArticlesReadyForPublishing(projectId?: string): Promise<Article[]> {
    let query = this.client.from('articles').select('*').eq('status', 'approved');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to fetch articles ready for publishing: ${error.message}`);
    }

    console.log(`✓ Found ${data.length} articles ready for publishing`);
    return data as Article[];
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
}
