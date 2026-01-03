import axios, { AxiosInstance } from 'axios';
import { WordPressPost, WordPressPostResponse } from '../types';

export class WordPressService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(wordpressUrl: string, username: string, appPassword: string) {
    this.baseUrl = wordpressUrl.replace(/\/$/, '');

    // Create axios instance with Basic Auth (Application Password)
    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json/wp/v2`,
      auth: {
        username,
        password: appPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new WordPress post
   */
  async createPost(post: WordPressPost): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.post<WordPressPostResponse>('/posts', post);
      console.log(`✓ Created WordPress post: ${response.data.id} - ${response.data.title.rendered}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('WordPress API Error:', error.response?.data);
        throw new Error(`Failed to create post: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update an existing WordPress post
   */
  async updatePost(postId: number, post: Partial<WordPressPost>): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.post<WordPressPostResponse>(`/posts/${postId}`, post);
      console.log(`✓ Updated WordPress post: ${postId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('WordPress API Error:', error.response?.data);
        throw new Error(`Failed to update post ${postId}: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get post by ID
   */
  async getPost(postId: number): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.get<WordPressPostResponse>(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get post ${postId}: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get post by slug
   */
  async getPostBySlug(slug: string): Promise<WordPressPostResponse | null> {
    try {
      const response = await this.client.get<WordPressPostResponse[]>('/posts', {
        params: { slug },
      });
      return response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get post by slug "${slug}": ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all published posts (for internal linking)
   */
  async getAllPosts(params?: { lang?: string; per_page?: number }): Promise<WordPressPostResponse[]> {
    try {
      const response = await this.client.get<WordPressPostResponse[]>('/posts', {
        params: {
          status: 'publish',
          per_page: params?.per_page || 100,
          lang: params?.lang,
        },
      });
      console.log(`✓ Fetched ${response.data.length} posts from WordPress`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get posts: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postId: number, force: boolean = false): Promise<void> {
    try {
      await this.client.delete(`/posts/${postId}`, {
        params: { force },
      });
      console.log(`✓ Deleted WordPress post: ${postId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to delete post ${postId}: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update ACF field
   */
  async updateACFField(postId: number, fieldName: string, value: any): Promise<void> {
    try {
      await this.client.post(`/posts/${postId}`, {
        acf: {
          [fieldName]: value,
        },
      });
      console.log(`✓ Updated ACF field "${fieldName}" for post ${postId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to update ACF field: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}
