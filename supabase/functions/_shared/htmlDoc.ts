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
    --font-heading: 'Georgia', 'Times New Roman', serif;
    --font-body: 'Helvetica Neue', Arial, sans-serif;
    --color-primary: #1a1a2e;
    --color-secondary: #e94560;
    --color-accent: #0f3460;
    --color-bg: #ffffff;
    --color-bg-alt: #f8f9fa;
    --color-text: #2d3436;
    --color-text-muted: #636e72;
    --color-border: #dfe6e9;
    --spacing-base: 1.5rem;
    --border-radius: 8px;
    --shadow: 0 4px 6px rgba(0,0,0,0.07);
  `,
  "minimal-clean": `
    --font-heading: 'Inter', 'Segoe UI', sans-serif;
    --font-body: 'Inter', 'Segoe UI', sans-serif;
    --color-primary: #2c3e50;
    --color-secondary: #3498db;
    --color-accent: #27ae60;
    --color-bg: #ffffff;
    --color-bg-alt: #fafafa;
    --color-text: #333333;
    --color-text-muted: #7f8c8d;
    --color-border: #ecf0f1;
    --spacing-base: 1.25rem;
    --border-radius: 4px;
    --shadow: 0 2px 4px rgba(0,0,0,0.05);
  `,
  "tech-neon": `
    --font-heading: 'Roboto', 'Arial', sans-serif;
    --font-body: 'Roboto', 'Arial', sans-serif;
    --color-primary: #0a192f;
    --color-secondary: #64ffda;
    --color-accent: #f06449;
    --color-bg: #ffffff;
    --color-bg-alt: #f0f4f8;
    --color-text: #1a202c;
    --color-text-muted: #4a5568;
    --color-border: #e2e8f0;
    --spacing-base: 1.5rem;
    --border-radius: 6px;
    --shadow: 0 4px 12px rgba(0,0,0,0.08);
  `,
};

// ============================================================================
// BASE CSS
// ============================================================================

const BASE_CSS = `
/* Reset & Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.7;
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

/* Container */
.article-container {
  max-width: 800px;
  margin: 0 auto;
  padding: calc(var(--spacing-base) * 2);
}

@media (max-width: 768px) {
  .article-container { padding: var(--spacing-base); }
}

/* Typography */
h1, h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-primary);
  margin-bottom: var(--spacing-base);
}

h1 { font-size: 2.5rem; margin-bottom: calc(var(--spacing-base) * 1.5); }
h2 { font-size: 1.875rem; margin-top: calc(var(--spacing-base) * 2); }
h3 { font-size: 1.5rem; margin-top: calc(var(--spacing-base) * 1.5); }
h4 { font-size: 1.25rem; margin-top: var(--spacing-base); }

p {
  margin-bottom: var(--spacing-base);
}

p.lead {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  line-height: 1.8;
}

p.compact {
  font-size: 0.9375rem;
  margin-bottom: calc(var(--spacing-base) * 0.75);
}

a {
  color: var(--color-secondary);
  text-decoration: none;
}
a:hover { text-decoration: underline; }

/* Section Headers */
.section-header {
  margin-top: calc(var(--spacing-base) * 2);
  margin-bottom: var(--spacing-base);
}

.section-header.badge h2,
.section-header.badge h3 {
  display: inline-block;
  background: var(--color-bg-alt);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  border-left: 4px solid var(--color-secondary);
}

.section-header.underline h2,
.section-header.underline h3 {
  padding-bottom: 0.75rem;
  border-bottom: 3px solid var(--color-secondary);
}

/* Lists */
.list-plain ul, .list-plain ol {
  padding-left: 1.5rem;
  margin-bottom: var(--spacing-base);
}

.list-plain li {
  margin-bottom: 0.5rem;
}

/* Checklist */
.list-checklist ul {
  list-style: none;
  padding: 0;
}

.list-checklist li {
  position: relative;
  padding-left: 2rem;
  margin-bottom: 0.75rem;
}

.list-checklist li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--color-accent);
  font-weight: bold;
}

/* Steps */
.list-steps ol {
  list-style: none;
  padding: 0;
  counter-reset: step;
}

.list-steps li {
  position: relative;
  padding-left: 3.5rem;
  margin-bottom: 1.25rem;
  counter-increment: step;
}

.list-steps li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  width: 2.5rem;
  height: 2.5rem;
  background: var(--color-secondary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1rem;
}

/* Cards List */
.list-cards ul {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.list-cards li {
  background: var(--color-bg-alt);
  padding: 1.25rem;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  border-left: 4px solid var(--color-secondary);
}

/* Tables */
.table-wrapper {
  overflow-x: auto;
  margin-bottom: var(--spacing-base);
  -webkit-overflow-scrolling: touch;
}

.table-wrapper table {
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
}

.table-wrapper th,
.table-wrapper td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.table-wrapper th {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

/* Zebra Table */
.table-zebra tbody tr:nth-child(even) {
  background: var(--color-bg-alt);
}

/* Comparison Table */
.table-comparison th {
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-comparison td:first-child {
  font-weight: 600;
  background: var(--color-bg-alt);
  position: sticky;
  left: 0;
}

/* Scroll hint */
.table-wrapper::after {
  content: "→ Scrollen für mehr";
  display: none;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: right;
  padding-top: 0.5rem;
}

@media (max-width: 768px) {
  .table-wrapper::after { display: block; }
}

/* Contrast Pair */
.contrast-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin: calc(var(--spacing-base) * 1.5) 0;
}

@media (max-width: 768px) {
  .contrast-pair { grid-template-columns: 1fr; }
}

.contrast-pair .side {
  background: var(--color-bg-alt);
  padding: 1.5rem;
  border-radius: var(--border-radius);
}

.contrast-pair .side-left {
  border-top: 4px solid var(--color-accent);
}

.contrast-pair .side-right {
  border-top: 4px solid var(--color-secondary);
}

.contrast-pair .label {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}

.contrast-pair-minimal .side {
  background: transparent;
  border-left: 3px solid var(--color-border);
  border-top: none;
  padding: 0 0 0 1rem;
}

/* Blockquote */
blockquote {
  border-left: 4px solid var(--color-secondary);
  padding: 1rem 1.5rem;
  margin: var(--spacing-base) 0;
  background: var(--color-bg-alt);
  font-style: italic;
  color: var(--color-text-muted);
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

/* Images */
.article-image {
  max-width: 100%;
  height: auto;
  border-radius: var(--border-radius);
  margin: var(--spacing-base) 0;
}

/* Code */
pre {
  background: var(--color-primary);
  color: #f8f8f2;
  padding: 1.25rem;
  border-radius: var(--border-radius);
  overflow-x: auto;
  margin: var(--spacing-base) 0;
  font-size: 0.875rem;
}

code {
  font-family: 'Fira Code', 'Consolas', monospace;
}

/* Callout */
.callout {
  padding: 1.25rem;
  border-radius: var(--border-radius);
  margin: var(--spacing-base) 0;
  border-left: 4px solid;
}

.callout-tip {
  background: #e8f5e9;
  border-color: #4caf50;
}

.callout-warning {
  background: #fff3e0;
  border-color: #ff9800;
}

.callout-info {
  background: #e3f2fd;
  border-color: #2196f3;
}

/* Takeaways */
.takeaways {
  background: var(--color-bg-alt);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin: calc(var(--spacing-base) * 1.5) 0;
}

.takeaways h4 {
  margin-top: 0;
  color: var(--color-secondary);
}

/* Table of Contents */
.toc {
  background: var(--color-bg-alt);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin-bottom: calc(var(--spacing-base) * 2);
}

.toc h4 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.toc ul {
  list-style: none;
  padding: 0;
}

.toc li {
  margin-bottom: 0.5rem;
}

.toc a {
  color: var(--color-text);
}

.toc a:hover {
  color: var(--color-secondary);
}

/* HR */
hr {
  border: none;
  border-top: 2px solid var(--color-border);
  margin: calc(var(--spacing-base) * 2) 0;
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

  const themeVars = THEME_STYLES[theme] || THEME_STYLES["minimal-clean"];

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeAttr(metaDescription || "")}">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      ${themeVars}
    }
    ${BASE_CSS}
  </style>
</head>
<body>
  <article class="article-container">
    ${bodyHtml}
  </article>
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
