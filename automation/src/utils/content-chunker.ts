/**
 * Content Chunking Utility
 *
 * Splits large content (articles, documents) into smaller chunks
 * for token-optimized processing by AI agents.
 */

/**
 * A chunk of content
 */
export interface ContentChunk {
  index: number;
  total: number;
  content: string;
  section?: string;
  wordCount: number;
  charCount: number;
}

/**
 * Article metadata (lightweight reference)
 */
export interface ArticleMetadata {
  id: string;
  title: string;
  wordCount: number;
  keywords: string[];
  sections: string[];
}

/**
 * Options for chunking
 */
export interface ChunkOptions {
  maxChunkSize?: number;    // Max characters per chunk
  maxChunkWords?: number;   // Max words per chunk
  preserveSections?: boolean; // Try to keep sections intact
  overlapSize?: number;     // Characters to overlap between chunks
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 4000,
  maxChunkWords: 800,
  preserveSections: true,
  overlapSize: 0
};

/**
 * Chunk article content by H2 sections
 */
export function chunkArticle(
  content: string,
  options: ChunkOptions = {}
): ContentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!content || content.trim().length === 0) {
    return [];
  }

  // If content is small enough, return as single chunk
  const wordCount = countWords(content);
  if (content.length <= opts.maxChunkSize && wordCount <= opts.maxChunkWords) {
    return [{
      index: 0,
      total: 1,
      content,
      wordCount,
      charCount: content.length
    }];
  }

  // Split by H2 sections
  const sections = splitBySections(content);

  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let currentSection = '';

  for (const section of sections) {
    const sectionHeader = extractSectionHeader(section);

    // If preserving sections and section fits, keep it intact
    if (opts.preserveSections) {
      const combinedLength = currentChunk.length + section.length;
      const combinedWords = countWords(currentChunk + section);

      if (combinedLength <= opts.maxChunkSize && combinedWords <= opts.maxChunkWords) {
        currentChunk += section;
        if (sectionHeader) currentSection = sectionHeader;
        continue;
      }
    }

    // Current chunk is full, save it
    if (currentChunk) {
      chunks.push(createChunk(currentChunk, chunks.length, currentSection));
    }

    // Check if section itself is too large
    if (section.length > opts.maxChunkSize || countWords(section) > opts.maxChunkWords) {
      // Split large section by paragraphs
      const subChunks = chunkByParagraphs(section, opts);
      for (const subChunk of subChunks) {
        chunks.push(createChunk(subChunk, chunks.length, sectionHeader || currentSection));
      }
      currentChunk = '';
    } else {
      currentChunk = section;
      if (sectionHeader) currentSection = sectionHeader;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push(createChunk(currentChunk, chunks.length, currentSection));
  }

  // Update total count
  return chunks.map(c => ({ ...c, total: chunks.length }));
}

/**
 * Split content by H2 headers
 */
export function splitBySections(content: string): string[] {
  // Split by ## headers, keeping the header with each section
  const sections = content.split(/(?=^## )/m);
  return sections.filter(s => s.trim().length > 0);
}

/**
 * Extract H2 header from section
 */
export function extractSectionHeader(section: string): string | undefined {
  const match = section.match(/^## (.+)$/m);
  return match ? match[1].trim() : undefined;
}

/**
 * Chunk by paragraphs when section is too large
 */
function chunkByParagraphs(content: string, opts: Required<ChunkOptions>): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const combinedLength = currentChunk.length + para.length + 2; // +2 for \n\n
    const combinedWords = countWords(currentChunk + '\n\n' + para);

    if (combinedLength <= opts.maxChunkSize && combinedWords <= opts.maxChunkWords) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If single paragraph is too large, split by sentences
      if (para.length > opts.maxChunkSize) {
        chunks.push(...chunkBySentences(para, opts));
        currentChunk = '';
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Chunk by sentences as last resort
 */
function chunkBySentences(content: string, opts: Required<ChunkOptions>): string[] {
  // Simple sentence splitting (handles German and English)
  const sentences = content.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const combinedLength = currentChunk.length + sentence.length + 1;

    if (combinedLength <= opts.maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Create a chunk object
 */
function createChunk(content: string, index: number, section?: string): ContentChunk {
  return {
    index,
    total: 0, // Will be updated later
    content,
    section,
    wordCount: countWords(content),
    charCount: content.length
  };
}

/**
 * Count words in content
 */
export function countWords(content: string): number {
  if (!content) return 0;
  return content.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extract article metadata without full content
 */
export function extractArticleMetadata(
  id: string,
  title: string,
  content: string,
  keywords: string[] = []
): ArticleMetadata {
  const sections = splitBySections(content)
    .map(extractSectionHeader)
    .filter((s): s is string => s !== undefined);

  return {
    id,
    title,
    wordCount: countWords(content),
    keywords,
    sections
  };
}

/**
 * Create a content summary for routing (minimal tokens)
 */
export function createContentSummary(
  content: string,
  maxLength: number = 500
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Get first section or first paragraph
  const sections = splitBySections(content);
  if (sections.length > 0 && sections[0].length <= maxLength) {
    return sections[0];
  }

  // Truncate with ellipsis
  return content.substring(0, maxLength - 3) + '...';
}

/**
 * Estimate token count (rough approximation)
 * Rule of thumb: ~4 characters per token for English/German
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/**
 * Limit tool output size
 */
export function limitToolOutput<T>(
  output: T,
  maxSize: number = 4000
): { data: T | null; truncated: boolean; summary: string; originalSize: number } {
  const stringified = JSON.stringify(output);
  const originalSize = stringified.length;

  if (originalSize <= maxSize) {
    return {
      data: output,
      truncated: false,
      summary: '',
      originalSize
    };
  }

  // Create summary
  let summary = '';
  if (Array.isArray(output)) {
    summary = `Array with ${output.length} elements. First 3: ${JSON.stringify(output.slice(0, 3))}...`;
  } else if (typeof output === 'object' && output !== null) {
    summary = `Object with keys: ${Object.keys(output).join(', ')}`;
  } else {
    summary = String(output).slice(0, 500) + '...';
  }

  return {
    data: null,
    truncated: true,
    summary,
    originalSize
  };
}
