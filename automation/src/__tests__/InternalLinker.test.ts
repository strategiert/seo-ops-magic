import { InternalLinker } from '../modules/InternalLinker';
import { LinkableArticle } from '../types';

describe('InternalLinker', () => {
  let linker: InternalLinker;

  const mockArticles: LinkableArticle[] = [
    {
      id: 'article-1',
      title: 'Body Cam Kaufberatung',
      slug: 'body-cam-kaufberatung',
      primaryKeyword: 'Body Cam',
      language: 'de',
    },
    {
      id: 'article-2',
      title: 'Dashcam Test 2024',
      slug: 'dashcam-test-2024',
      primaryKeyword: 'Dashcam',
      language: 'de',
    },
    {
      id: 'article-3',
      title: 'Security Camera Guide',
      slug: 'security-camera-guide',
      primaryKeyword: 'Security Camera',
      language: 'en',
    },
    {
      id: 'article-4',
      title: 'Überwachungskamera Vergleich',
      slug: 'ueberwachungskamera-vergleich',
      primaryKeyword: 'Überwachungskamera',
      language: 'de',
      wpPostId: 123,
    },
  ];

  beforeEach(() => {
    linker = new InternalLinker();
    // Suppress console.log during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadArticles', () => {
    it('should load articles successfully', () => {
      linker.loadArticles(mockArticles);
      const stats = linker.getStats();
      expect(stats.total).toBe(4);
    });

    it('should track articles by language', () => {
      linker.loadArticles(mockArticles);
      const stats = linker.getStats();
      expect(stats.byLanguage).toEqual({ de: 3, en: 1 });
    });
  });

  describe('findInternalLinks', () => {
    beforeEach(() => {
      linker.loadArticles(mockArticles);
    });

    it('should find keyword matches in content', () => {
      const content = 'Die beste Body Cam für den Einsatz ist wichtig. Eine Dashcam ist auch hilfreich.';
      const links = linker.findInternalLinks(content, 'current-article', 'de');

      expect(links.length).toBe(2);
      expect(links[0].keyword).toBe('Body Cam');
      expect(links[1].keyword).toBe('Dashcam');
    });

    it('should not self-link to current article', () => {
      const content = 'Die beste Body Cam für den Einsatz.';
      const links = linker.findInternalLinks(content, 'article-1', 'de');

      expect(links.length).toBe(0);
    });

    it('should filter by language', () => {
      const content = 'Security Camera is important. Body Cam is also good.';
      const links = linker.findInternalLinks(content, 'current-article', 'en');

      expect(links.length).toBe(1);
      expect(links[0].keyword).toBe('Security Camera');
    });

    it('should respect maxLinks limit', () => {
      const content = 'Body Cam und Dashcam und Überwachungskamera sind alle wichtig.';
      const links = linker.findInternalLinks(content, 'current-article', 'de', 2);

      expect(links.length).toBe(2);
    });

    it('should handle case-insensitive matching', () => {
      const content = 'Eine BODY CAM ist wichtig.';
      const links = linker.findInternalLinks(content, 'current-article', 'de');

      expect(links.length).toBe(1);
      expect(links[0].keyword).toBe('Body Cam');
    });

    it('should use wpPostId for URL when available', () => {
      const content = 'Eine Überwachungskamera ist wichtig.';
      const links = linker.findInternalLinks(content, 'current-article', 'de');

      expect(links.length).toBe(1);
      expect(links[0].targetUrl).toBe('/posts/123');
    });

    it('should use slug for URL when wpPostId is not available', () => {
      const content = 'Eine Body Cam ist wichtig.';
      const links = linker.findInternalLinks(content, 'current-article', 'de');

      expect(links.length).toBe(1);
      expect(links[0].targetUrl).toBe('/body-cam-kaufberatung');
    });

    it('should return empty array when no matches found', () => {
      const content = 'Keine relevanten Keywords hier.';
      const links = linker.findInternalLinks(content, 'current-article', 'de');

      expect(links).toEqual([]);
    });
  });

  describe('insertLinksIntoHTML', () => {
    beforeEach(() => {
      linker.loadArticles(mockArticles);
    });

    it('should insert links into HTML content', () => {
      const html = '<p>Die beste Body Cam für den Einsatz.</p>';
      const links = linker.findInternalLinks(html, 'current-article', 'de');
      const linkedHtml = linker.insertLinksIntoHTML(html, links);

      expect(linkedHtml).toContain('<a href="/body-cam-kaufberatung"');
      expect(linkedHtml).toContain('Body Cam</a>');
    });

    it('should only replace first occurrence', () => {
      const html = '<p>Body Cam ist gut. Body Cam ist toll.</p>';
      const links = linker.findInternalLinks(html, 'current-article', 'de');
      const linkedHtml = linker.insertLinksIntoHTML(html, links);

      const linkCount = (linkedHtml.match(/<a href/g) || []).length;
      expect(linkCount).toBe(1);
    });

    it('should add proper CSS classes and title attribute', () => {
      const html = '<p>Die beste Body Cam.</p>';
      const links = linker.findInternalLinks(html, 'current-article', 'de');
      const linkedHtml = linker.insertLinksIntoHTML(html, links);

      expect(linkedHtml).toContain('class="text-blue-600 hover:text-blue-800 underline font-semibold"');
      expect(linkedHtml).toContain('title="Body Cam Kaufberatung"');
    });
  });

  describe('insertLinksIntoMarkdown', () => {
    beforeEach(() => {
      linker.loadArticles(mockArticles);
    });

    it('should insert links into Markdown content', () => {
      const markdown = 'Die beste Body Cam für den Einsatz.';
      const links = linker.findInternalLinks(markdown, 'current-article', 'de');
      const linkedMarkdown = linker.insertLinksIntoMarkdown(markdown, links);

      expect(linkedMarkdown).toContain('[Body Cam](/body-cam-kaufberatung "Body Cam Kaufberatung")');
    });

    it('should only replace first occurrence in Markdown', () => {
      const markdown = 'Body Cam ist gut. Body Cam ist toll.';
      const links = linker.findInternalLinks(markdown, 'current-article', 'de');
      const linkedMarkdown = linker.insertLinksIntoMarkdown(markdown, links);

      const linkCount = (linkedMarkdown.match(/\[Body Cam\]/g) || []).length;
      expect(linkCount).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty linker', () => {
      const stats = linker.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byLanguage).toEqual({});
    });

    it('should return correct stats after loading articles', () => {
      linker.loadArticles(mockArticles);
      const stats = linker.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byLanguage.de).toBe(3);
      expect(stats.byLanguage.en).toBe(1);
    });
  });
});
