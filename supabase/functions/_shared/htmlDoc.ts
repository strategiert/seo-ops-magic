/**
 * HTML Document Generator
 * Creates complete HTML documents with embedded CSS
 */

import type { Theme } from "./recipeSchema.ts";

// ============================================================================
// THEME CSS VARIABLES
// ============================================================================

const THEME_STYLES: Record<Theme, string> = {
  "editorial-bold": `
    --font-heading: 'Merriweather', 'Georgia', serif;
    --font-body: 'Inter', 'Helvetica Neue', sans-serif;
    --color-primary: #111827;
    --color-secondary: #dc2626;
    --color-accent: #f3f4f6;
    --color-bg: #ffffff;
    --color-bg-alt: #f9fafb;
    --color-text: #374151;
    --color-text-muted: #6b7280;
    --color-border: #e5e7eb;
    --spacing-base: 1.5rem;
    --border-radius: 4px;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `,
  "minimal-clean": `
    --font-heading: 'Plus Jakarta Sans', 'Inter', sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    --color-primary: #003366;
    --color-secondary: #ff6600;
    --color-accent: #f0f7ff;
    --color-bg: #ffffff;
    --color-bg-alt: #f8fbff;
    --color-text: #334155;
    --color-text-muted: #64748b;
    --color-border: #e2e8f0;
    --spacing-base: 1.5rem;
    --border-radius: 12px;
    --shadow: 0 10px 15px -3px rgba(0, 51, 102, 0.1);
  `,
  "tech-neon": `
    --font-heading: 'Space Grotesk', sans-serif;
    --font-body: 'Inter', sans-serif;
    --color-primary: #020617;
    --color-secondary: #818cf8;
    --color-accent: #1e293b;
    --color-bg: #ffffff;
    --color-bg-alt: #f1f5f9;
    --color-text: #1e293b;
    --color-text-muted: #475569;
    --color-border: #cbd5e1;
    --spacing-base: 1.5rem;
    --border-radius: 8px;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `,
};

// ============================================================================
// BASE CSS
// ============================================================================

const BASE_CSS = `
/* Import Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Merriweather:wght@400;700&family=Plus+Jakarta+Sans:wght@500;700;800&family=Space+Grotesk:wght@500;700&display=swap');

/* Scoped Container to avoid WP conflicts */
.seo-ops-content {
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 1.8;
  color: var(--color-text);
  background: var(--color-bg);
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  box-sizing: border-box;
}

/* Reset for internal elements */
.seo-ops-content *,
.seo-ops-content *::before,
.seo-ops-content *::after {
  box-sizing: border-box;
}

/* Typography */
.seo-ops-content h1,
.seo-ops-content h2,
.seo-ops-content h3,
.seo-ops-content h4 {
  font-family: var(--font-heading);
  font-weight: 800;
  line-height: 1.25;
  color: var(--color-primary);
  margin-top: 2.5rem;
  margin-bottom: 1rem;
}

.seo-ops-content h1 {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  text-align: center;
  margin-bottom: 2rem;
  margin-top: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  padding-bottom: 0.2em; /* Prevent descender clipping */
}

/* Hero Lead Paragraph (First paragraph after H1) */
.seo-ops-content h1 + p {
  font-size: 1.25rem;
  line-height: 1.8;
  text-align: center;
  max-width: 700px;
  margin: 0 auto 3rem auto;
  color: var(--color-text-muted);
}

.seo-ops-content h2 {
  font-size: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-border);
}

.seo-ops-content h3 {
  font-size: 1.5rem;
}

.seo-ops-content p {
  margin-bottom: 1.5rem;
}

.seo-ops-content a {
  color: var(--color-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.seo-ops-content a:hover {
  text-decoration: underline;
  color: var(--color-primary);
}

/* Section Headers & Badges */
.seo-ops-content .section-header.badge h2,
.seo-ops-content .section-header.badge h3 {
  display: inline-block;
  background: var(--color-accent);
  color: var(--color-primary);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  border-bottom: none;
  font-size: 1.75rem;
}

/* Lists */
.seo-ops-content ul, .seo-ops-content ol {
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.seo-ops-content li {
  margin-bottom: 0.5rem;
}

/* Rich Components: Cards */
.seo-ops-content .list-cards ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  list-style: none;
  padding: 0;
}

.seo-ops-content .list-cards li {
  background: var(--color-bg-alt);
  padding: 2rem;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  border-top: 4px solid var(--color-secondary);
  transition: transform 0.2s;
}

.seo-ops-content .list-cards li:hover {
  transform: translateY(-4px);
}

/* Tables */
.seo-ops-content .table-wrapper {
  overflow-x: auto;
  margin: 2rem 0;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  background: white;
}

.seo-ops-content table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.seo-ops-content th,
.seo-ops-content td {
  padding: 1rem 1.5rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.seo-ops-content th {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.875rem;
  letter-spacing: 0.05em;
}

.seo-ops-content tr:last-child td {
  border-bottom: none;
}

/* Zebra Striping */
.seo-ops-content .table-zebra tbody tr:nth-child(even) {
  background: var(--color-bg-alt);
}

/* Contrast Pair (Split View) */
.seo-ops-content .contrast-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 3rem 0;
  align-items: start;
}

@media (max-width: 768px) {
  .seo-ops-content .contrast-pair { grid-template-columns: 1fr; gap: 1rem; }
}

.seo-ops-content .contrast-pair .side {
  background: var(--color-bg-alt);
  padding: 2rem;
  border-radius: var(--border-radius);
  height: 100%;
}

.seo-ops-content .contrast-pair .side-left {
  background: var(--color-primary);
  color: white;
}

.seo-ops-content .contrast-pair .side-left h2,
.seo-ops-content .contrast-pair .side-left h3,
.seo-ops-content .contrast-pair .side-left p {
  color: white;
}

.seo-ops-content .contrast-pair .side-right {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
}

.seo-ops-content .contrast-pair .label {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.8;
  font-weight: 700;
}

/* Callouts */
.seo-ops-content .callout {
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin: 2rem 0;
  border-left: 5px solid;
  background: var(--color-bg-alt);
}

.seo-ops-content .callout-tip {
  border-color: #10b981;
  background: #ecfdf5;
}

.seo-ops-content .callout-warning {
  border-color: #f59e0b;
  background: #fffbeb;
}

.seo-ops-content .callout-info {
  border-color: #3b82f6;
  background: #eff6ff;
}

/* Table of Contents - Sidebar Style */
.seo-ops-content .toc {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin-bottom: 3rem;
  margin-top: 1rem;
}

.seo-ops-content .toc h4 {
  margin-top: 0;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.seo-ops-content .toc ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.seo-ops-content .toc li {
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.seo-ops-content .toc a {
  color: var(--color-text);
  text-decoration: none;
  display: block;
  padding: 0.25rem 0;
  border-bottom: 1px solid transparent;
}

.seo-ops-content .toc a:hover {
  color: var(--color-secondary);
  padding-left: 0.5rem;
}

/* Responsive */
@media (max-width: 640px) {
  .seo-ops-content {
    padding: 1.5rem;
  }
}
`;

// ============================================================================
// HTML DOCUMENT BUILDER
// ============================================================================

export interface HtmlDocOptions {
  title: string;
  theme: Theme;
  bodyHtml: string;
  metaDescription?: string;
}

/**
 * Generate a complete HTML document
 */
export function generateHtmlDocument(options: HtmlDocOptions): string {
  const { title, theme, bodyHtml, metaDescription } = options;

  // Inline wrapper style
  const wrapperStyle = "font-family: 'PT Sans', sans-serif; color: #333333; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f8f8f8; box-shadow: 0 0 15px rgba(0, 0, 0, 0.05); border-radius: 10px;";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeAttr(metaDescription || "")}">
  <title>${escapeHtml(title)}</title>
  <!-- Import Fonts for NetCo Design -->
  <link href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&family=PT+Sans:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
</head>
<body>
  <div id="seo-ops-content-wrapper" style="${wrapperStyle}">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}
