/**
 * HTML Sanitizer for Edge Functions
 * Removes dangerous elements before processing
 */

/**
 * Strip dangerous HTML elements and attributes
 * - Removes script tags
 * - Removes iframes
 * - Removes event handler attributes (onclick, onload, etc.)
 */
export function stripDangerous(html: string): string {
  return html
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove iframe tags and content
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Remove style tags (we use inline styles)
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove event handlers with double quotes
    .replace(/\s+on\w+="[^"]*"/gi, "")
    // Remove event handlers with single quotes
    .replace(/\s+on\w+='[^']*'/gi, "")
    // Remove javascript: URLs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Remove data: URLs in src (potential XSS)
    .replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
}

/**
 * Escape HTML special characters for safe text rendering
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Unescape HTML entities back to characters
 */
export function unescapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
  };
  return text.replace(/&(?:amp|lt|gt|quot|#0?39);/g, (entity) => map[entity] || entity);
}
