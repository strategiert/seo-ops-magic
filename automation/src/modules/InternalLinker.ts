import { InternalLink, LinkableArticle } from '../types';

export class InternalLinker {
  private linkableArticles: LinkableArticle[] = [];

  /**
   * Load all published articles for internal linking
   */
  loadArticles(articles: LinkableArticle[]): void {
    this.linkableArticles = articles;
    console.log(`✓ Loaded ${articles.length} articles for internal linking`);
  }

  /**
   * Find potential internal links in content
   * @param content - HTML or Markdown content
   * @param currentArticleId - ID of current article (to avoid self-linking)
   * @param language - Language code to filter links
   * @param maxLinks - Maximum number of links to insert (default: 5)
   */
  findInternalLinks(
    content: string,
    currentArticleId: string,
    language: string = 'de',
    maxLinks: number = 5
  ): InternalLink[] {
    const links: InternalLink[] = [];
    const contentLower = content.toLowerCase();

    // Filter articles by language and exclude current article
    const availableArticles = this.linkableArticles.filter(
      (article) => article.language === language && article.id !== currentArticleId
    );

    for (const article of availableArticles) {
      if (links.length >= maxLinks) break;

      // Check if article's primary keyword appears in content
      const keyword = article.primaryKeyword.toLowerCase();

      // Find keyword occurrences (case-insensitive)
      if (contentLower.includes(keyword)) {
        // Avoid duplicate links to same article
        const alreadyLinked = links.some((link) => link.targetSlug === article.slug);
        if (alreadyLinked) continue;

        links.push({
          keyword: article.primaryKeyword,
          targetSlug: article.slug,
          targetTitle: article.title,
          targetUrl: article.wpPostId ? `/posts/${article.wpPostId}` : `/${article.slug}`,
          language: article.language,
        });

        console.log(`  → Found link opportunity: "${keyword}" → ${article.title}`);
      }
    }

    console.log(`✓ Found ${links.length} internal link opportunities`);
    return links;
  }

  /**
   * Insert internal links into HTML content
   * @param html - HTML content
   * @param links - Array of internal links to insert
   */
  insertLinksIntoHTML(html: string, links: InternalLink[]): string {
    let linkedHtml = html;

    for (const link of links) {
      // Create a case-insensitive regex to find first occurrence of keyword
      // Avoid linking inside existing <a> tags or HTML tags
      const regex = new RegExp(
        `(?<!<[^>]*)(\\b${this.escapeRegex(link.keyword)}\\b)(?![^<]*>)`,
        'i'
      );

      // Replace first occurrence with link
      linkedHtml = linkedHtml.replace(
        regex,
        `<a href="${link.targetUrl}" class="text-blue-600 hover:text-blue-800 underline font-semibold" title="${link.targetTitle}">$1</a>`
      );
    }

    console.log(`✓ Inserted ${links.length} internal links into HTML`);
    return linkedHtml;
  }

  /**
   * Insert internal links into Markdown content
   */
  insertLinksIntoMarkdown(markdown: string, links: InternalLink[]): string {
    let linkedMarkdown = markdown;

    for (const link of links) {
      // Case-insensitive replacement of first occurrence
      const regex = new RegExp(
        `(?<!\\[)\\b${this.escapeRegex(link.keyword)}\\b(?!\\])`,
        'i'
      );

      linkedMarkdown = linkedMarkdown.replace(
        regex,
        `[${link.keyword}](${link.targetUrl} "${link.targetTitle}")`
      );
    }

    console.log(`✓ Inserted ${links.length} internal links into Markdown`);
    return linkedMarkdown;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get article statistics
   */
  getStats(): { total: number; byLanguage: Record<string, number> } {
    const byLanguage: Record<string, number> = {};

    for (const article of this.linkableArticles) {
      byLanguage[article.language] = (byLanguage[article.language] || 0) + 1;
    }

    return {
      total: this.linkableArticles.length,
      byLanguage,
    };
  }
}
