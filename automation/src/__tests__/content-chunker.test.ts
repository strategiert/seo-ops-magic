import {
  chunkArticle,
  splitBySections,
  extractSectionHeader,
  countWords,
  extractArticleMetadata,
  createContentSummary,
  estimateTokens,
  limitToolOutput,
  ContentChunk
} from '../utils/content-chunker';

describe('Content Chunker', () => {
  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test sentence.')).toBe(5);
      expect(countWords('Ein deutscher Text mit Umlauten: äöü')).toBe(6);
    });

    it('should handle empty content', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('should handle multiple spaces', () => {
      expect(countWords('Hello    world   test')).toBe(3);
    });

    it('should handle newlines', () => {
      expect(countWords('Hello\nworld\ntest')).toBe(3);
    });
  });

  describe('splitBySections', () => {
    it('should split content by H2 headers', () => {
      const content = `# Main Title

Introduction text.

## Section One

Content for section one.

## Section Two

Content for section two.`;

      const sections = splitBySections(content);

      expect(sections.length).toBe(3);
      expect(sections[0]).toContain('Introduction');
      expect(sections[1]).toContain('## Section One');
      expect(sections[2]).toContain('## Section Two');
    });

    it('should handle content without sections', () => {
      const content = 'Just some plain text without headers.';
      const sections = splitBySections(content);

      expect(sections.length).toBe(1);
      expect(sections[0]).toBe(content);
    });

    it('should handle empty content', () => {
      const sections = splitBySections('');
      expect(sections.length).toBe(0);
    });
  });

  describe('extractSectionHeader', () => {
    it('should extract H2 header', () => {
      const section = `## My Section Title

Some content here.`;

      const header = extractSectionHeader(section);
      expect(header).toBe('My Section Title');
    });

    it('should return undefined for content without H2', () => {
      const content = 'Just some text without headers.';
      expect(extractSectionHeader(content)).toBeUndefined();
    });

    it('should ignore H1 and H3 headers', () => {
      expect(extractSectionHeader('# H1 Header')).toBeUndefined();
      expect(extractSectionHeader('### H3 Header')).toBeUndefined();
    });

    it('should handle German headers', () => {
      const section = `## Übersicht und Einführung

Deutscher Inhalt hier.`;

      const header = extractSectionHeader(section);
      expect(header).toBe('Übersicht und Einführung');
    });
  });

  describe('chunkArticle', () => {
    it('should return empty array for empty content', () => {
      const chunks = chunkArticle('');
      expect(chunks).toHaveLength(0);
    });

    it('should return single chunk for small content', () => {
      const content = 'This is a short article.';
      const chunks = chunkArticle(content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].total).toBe(1);
    });

    it('should chunk large content by sections', () => {
      const content = `# Article Title

Introduction paragraph with some text.

## Section One

${'Lorem ipsum dolor sit amet. '.repeat(200)}

## Section Two

${'More content here for testing. '.repeat(200)}

## Section Three

Final section content.`;

      const chunks = chunkArticle(content, { maxChunkSize: 2000 });

      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should have correct metadata
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
        expect(chunks[i].total).toBe(chunks.length);
        expect(chunks[i].wordCount).toBeGreaterThan(0);
        expect(chunks[i].charCount).toBeGreaterThan(0);
      }
    });

    it('should preserve section information', () => {
      const content = `## First Section

Some content here.

## Second Section

More content here.`;

      const chunks = chunkArticle(content, { maxChunkSize: 10000 });

      // With large maxChunkSize, should be single chunk
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle unstructured content as single chunk', () => {
      // Content without H2 sections is treated as a single block
      const content = 'A '.repeat(1000); // 2000 characters, no sections
      const chunks = chunkArticle(content, { maxChunkSize: 500 });

      // Unstructured content remains as single chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].wordCount).toBe(1000);
    });

    it('should chunk structured content by sections', () => {
      // Content WITH H2 sections should be chunked
      const content = `## Section 1

${'First section content. '.repeat(100)}

## Section 2

${'Second section content. '.repeat(100)}

## Section 3

${'Third section content. '.repeat(100)}`;

      const chunks = chunkArticle(content, { maxChunkSize: 1000 });

      // Should create multiple chunks based on sections
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle German content', () => {
      const content = `## Einführung

Dies ist ein deutscher Artikel über Content Marketing.

## Hauptteil

Hier kommt der Hauptinhalt mit vielen deutschen Wörtern und Umlauten wie ä, ö, ü.

## Fazit

Zusammenfassung und Schlussfolgerungen.`;

      const chunks = chunkArticle(content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].content).toContain('Einführung');
    });
  });

  describe('extractArticleMetadata', () => {
    it('should extract metadata correctly', () => {
      const content = `## Introduction

Some intro text.

## Main Content

The main part.

## Conclusion

Final thoughts.`;

      const metadata = extractArticleMetadata(
        'article-123',
        'Test Article',
        content,
        ['seo', 'marketing']
      );

      expect(metadata.id).toBe('article-123');
      expect(metadata.title).toBe('Test Article');
      expect(metadata.wordCount).toBeGreaterThan(0);
      expect(metadata.keywords).toEqual(['seo', 'marketing']);
      expect(metadata.sections).toContain('Introduction');
      expect(metadata.sections).toContain('Main Content');
      expect(metadata.sections).toContain('Conclusion');
    });

    it('should handle content without sections', () => {
      const metadata = extractArticleMetadata(
        'id',
        'Title',
        'Just plain text without headers.'
      );

      expect(metadata.sections).toHaveLength(0);
      expect(metadata.keywords).toEqual([]);
    });
  });

  describe('createContentSummary', () => {
    it('should return full content if short enough', () => {
      const content = 'Short content.';
      const summary = createContentSummary(content, 100);

      expect(summary).toBe(content);
    });

    it('should truncate long content', () => {
      const content = 'A'.repeat(1000);
      const summary = createContentSummary(content, 100);

      expect(summary.length).toBe(100);
      expect(summary.endsWith('...')).toBe(true);
    });

    it('should return first section if it fits', () => {
      const content = `## First Section

Short first section.

## Second Section

Much longer second section with more content...`;

      const summary = createContentSummary(content, 100);

      expect(summary).toContain('First Section');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const content = 'A'.repeat(400); // 400 chars = ~100 tokens
      const estimate = estimateTokens(content);

      expect(estimate).toBe(100);
    });

    it('should handle empty content', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should round up', () => {
      const content = 'ABC'; // 3 chars = 0.75 tokens, rounded up to 1
      expect(estimateTokens(content)).toBe(1);
    });
  });

  describe('limitToolOutput', () => {
    it('should not truncate small output', () => {
      const output = { key: 'value' };
      const result = limitToolOutput(output, 1000);

      expect(result.truncated).toBe(false);
      expect(result.data).toEqual(output);
      expect(result.summary).toBe('');
    });

    it('should truncate large array output', () => {
      const output = Array(100).fill({ id: 1, name: 'test item with content' });
      const result = limitToolOutput(output, 100);

      expect(result.truncated).toBe(true);
      expect(result.data).toBeNull();
      expect(result.summary).toContain('Array with 100 elements');
    });

    it('should truncate large object output', () => {
      const output = {
        key1: 'value1',
        key2: 'value2',
        key3: 'A'.repeat(1000)
      };
      const result = limitToolOutput(output, 100);

      expect(result.truncated).toBe(true);
      expect(result.summary).toContain('Object with keys:');
      expect(result.summary).toContain('key1');
    });

    it('should include original size', () => {
      const output = { data: 'test' };
      const result = limitToolOutput(output);

      expect(result.originalSize).toBeGreaterThan(0);
    });
  });
});

describe('Content Chunk Structure', () => {
  it('should have all required fields', () => {
    const content = `## Test Section

Some test content for validation.`;

    const chunks = chunkArticle(content);

    for (const chunk of chunks) {
      expect(chunk).toHaveProperty('index');
      expect(chunk).toHaveProperty('total');
      expect(chunk).toHaveProperty('content');
      expect(chunk).toHaveProperty('wordCount');
      expect(chunk).toHaveProperty('charCount');

      expect(typeof chunk.index).toBe('number');
      expect(typeof chunk.total).toBe('number');
      expect(typeof chunk.content).toBe('string');
      expect(typeof chunk.wordCount).toBe('number');
      expect(typeof chunk.charCount).toBe('number');
    }
  });

  it('should have consistent index and total', () => {
    const content = `## Section 1

${'Content '.repeat(500)}

## Section 2

${'More content '.repeat(500)}

## Section 3

${'Final content '.repeat(500)}`;

    const chunks = chunkArticle(content, { maxChunkSize: 1000 });

    const total = chunks[0].total;

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].total).toBe(total);
    }

    expect(chunks.length).toBe(total);
  });
});
