import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Skill Loader - Dynamisches Laden von Skill-Dokumenten
 * 
 * Lädt Skills aus .claude/skills/ basierend auf REGISTRY.json
 * Implementiert Lazy Loading für Token-Optimierung
 */

// Skill Registry Type (aus REGISTRY.json)
export interface SkillDefinition {
  summary: string;
  entryPoint: string;
  supportingDocs: string[];
  category: string;
  estimatedTokens: number;
}

export interface SkillRegistry {
  version: string;
  skills: Record<string, SkillDefinition>;
  categories: Record<string, { description: string; skills: string[] }>;
}

// In-Memory Cache
const skillCache: Map<string, { content: string; loadedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

// Base path für Skills (relativ zum Projekt-Root)
const SKILLS_BASE_PATH = ".claude/skills";

/**
 * Lädt die REGISTRY.json mit allen Skill-Summaries
 * Das ist das einzige was der Router initial sieht
 */
export function loadSkillRegistry(): SkillRegistry {
  const registryPath = join(process.cwd(), SKILLS_BASE_PATH, "REGISTRY.json");
  
  if (!existsSync(registryPath)) {
    // Fallback: Embedded Registry für Vercel Deployment
    return getEmbeddedRegistry();
  }
  
  const content = readFileSync(registryPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Gibt nur die Skill-Summaries zurück (für Router)
 * Minimal Token-Verbrauch
 */
export function getSkillSummaries(): Record<string, string> {
  const registry = loadSkillRegistry();
  const summaries: Record<string, string> = {};
  
  for (const [skillId, skill] of Object.entries(registry.skills)) {
    summaries[skillId] = skill.summary;
  }
  
  return summaries;
}

/**
 * Lädt die Haupt-SKILL.md für einen spezifischen Skill
 * Wird aufgerufen wenn der Router entschieden hat, welcher Skill gebraucht wird
 */
export function loadSkillDocument(skillId: string): string | null {
  const cacheKey = `${skillId}/SKILL.md`;
  
  // Check Cache
  const cached = skillCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.content;
  }
  
  const skillPath = join(process.cwd(), SKILLS_BASE_PATH, skillId, "SKILL.md");
  
  if (!existsSync(skillPath)) {
    console.warn(`Skill document not found: ${skillPath}`);
    return getEmbeddedSkill(skillId);
  }
  
  const content = readFileSync(skillPath, "utf-8");
  skillCache.set(cacheKey, { content, loadedAt: Date.now() });
  
  return content;
}

/**
 * Lädt ein Supporting Document für einen Skill
 * Wird nur bei Bedarf geladen (z.B. PLATFORM_SPECS.md für Social Posts)
 */
export function loadSupportingDocument(skillId: string, docName: string): string | null {
  const cacheKey = `${skillId}/${docName}`;
  
  // Check Cache
  const cached = skillCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.content;
  }
  
  const docPath = join(process.cwd(), SKILLS_BASE_PATH, skillId, docName);
  
  if (!existsSync(docPath)) {
    console.warn(`Supporting document not found: ${docPath}`);
    return null;
  }
  
  const content = readFileSync(docPath, "utf-8");
  skillCache.set(cacheKey, { content, loadedAt: Date.now() });
  
  return content;
}

/**
 * Lädt alle Dokumente für einen Skill (SKILL.md + Supporting Docs)
 * Nur für komplexe Aufgaben verwenden - hoher Token-Verbrauch!
 */
export function loadFullSkillContext(skillId: string): {
  main: string;
  supporting: Record<string, string>;
  totalTokensEstimate: number;
} {
  const registry = loadSkillRegistry();
  const skillDef = registry.skills[skillId];
  
  if (!skillDef) {
    throw new Error(`Unknown skill: ${skillId}`);
  }
  
  const main = loadSkillDocument(skillId) || "";
  const supporting: Record<string, string> = {};
  
  for (const docName of skillDef.supportingDocs) {
    const doc = loadSupportingDocument(skillId, docName);
    if (doc) {
      supporting[docName] = doc;
    }
  }
  
  return {
    main,
    supporting,
    totalTokensEstimate: skillDef.estimatedTokens,
  };
}

/**
 * Kategorisiert Skills für den Router
 */
export function getSkillsByCategory(): Record<string, string[]> {
  const registry = loadSkillRegistry();
  const result: Record<string, string[]> = {};
  
  for (const [category, def] of Object.entries(registry.categories)) {
    result[category] = def.skills;
  }
  
  return result;
}

/**
 * Prüft ob ein Skill existiert
 */
export function skillExists(skillId: string): boolean {
  const registry = loadSkillRegistry();
  return skillId in registry.skills;
}

/**
 * Gibt die geschätzten Token für einen Skill zurück
 */
export function getSkillTokenEstimate(skillId: string): number {
  const registry = loadSkillRegistry();
  return registry.skills[skillId]?.estimatedTokens || 0;
}

// ============ Embedded Fallbacks für Vercel ============

function getEmbeddedRegistry(): SkillRegistry {
  return {
    version: "1.0.0",
    skills: {
      "social-post-creator": {
        summary: "Erstellt plattformspezifische Social Media Posts (LinkedIn, Instagram, TikTok, Twitter, Facebook)",
        entryPoint: "SKILL.md",
        supportingDocs: ["PLATFORM_SPECS.md", "TONE_GUIDELINES.md"],
        category: "content-transformation",
        estimatedTokens: 8000,
      },
      "seo-content-writer": {
        summary: "Erstellt SEO-optimierte Pillar-Artikel basierend auf NeuronWriter Briefs",
        entryPoint: "SKILL.md",
        supportingDocs: ["CONTENT_TYPES.md", "CONTENT_STRUCTURE.md"],
        category: "content-creation",
        estimatedTokens: 10000,
      },
      "ad-copy-writer": {
        summary: "Erstellt Werbetexte für Google, Meta, LinkedIn Ads",
        entryPoint: "SKILL.md",
        supportingDocs: ["PLATFORM_REQUIREMENTS.md", "COPYWRITING_FORMULAS.md"],
        category: "content-transformation",
        estimatedTokens: 12000,
      },
      "press-release-writer": {
        summary: "Erstellt Pressemeldungen nach AP Style",
        entryPoint: "SKILL.md",
        supportingDocs: ["AP_STYLE_GUIDE.md"],
        category: "content-transformation",
        estimatedTokens: 10000,
      },
      "html-designer": {
        summary: "Wandelt Markdown in gestyltes HTML mit Tailwind CSS um",
        entryPoint: "SKILL.md",
        supportingDocs: ["TYPOGRAPHY.md", "COMPONENTS.md"],
        category: "content-creation",
        estimatedTokens: 12000,
      },
      "wordpress-publisher": {
        summary: "Veröffentlicht Content auf WordPress via REST API",
        entryPoint: "SKILL.md",
        supportingDocs: ["API_REFERENCE.md"],
        category: "content-creation",
        estimatedTokens: 6000,
      },
      "internal-linker": {
        summary: "Analysiert Artikel und schlägt interne Verlinkungen vor",
        entryPoint: "SKILL.md",
        supportingDocs: ["STRATEGIES.md"],
        category: "seo",
        estimatedTokens: 8000,
      },
      "content-translator": {
        summary: "Übersetzt Marketing-Content DE↔EN mit SEO-Keywords",
        entryPoint: "SKILL.md",
        supportingDocs: ["CULTURAL_ADAPTATIONS.md"],
        category: "content-transformation",
        estimatedTokens: 9000,
      },
      "newsletter-composer": {
        summary: "Erstellt Newsletter mit optimierten Betreffzeilen",
        entryPoint: "SKILL.md",
        supportingDocs: ["SUBJECT_LINE_FORMULAS.md"],
        category: "content-transformation",
        estimatedTokens: 6000,
      },
      "image-generator": {
        summary: "Erstellt AI-Bild-Prompts für DALL-E, Midjourney",
        entryPoint: "SKILL.md",
        supportingDocs: ["AI_PROMPT_PATTERNS.md"],
        category: "visual-assets",
        estimatedTokens: 8000,
      },
    },
    categories: {
      "content-transformation": {
        description: "Transformiert Pillar-Content in verschiedene Formate",
        skills: ["social-post-creator", "ad-copy-writer", "press-release-writer", "newsletter-composer", "content-translator"],
      },
      "content-creation": {
        description: "Erstellt und publiziert neuen Content",
        skills: ["seo-content-writer", "html-designer", "wordpress-publisher"],
      },
      "visual-assets": {
        description: "Erstellt visuelle Inhalte",
        skills: ["image-generator"],
      },
      "seo": {
        description: "SEO-Optimierung und Linking",
        skills: ["internal-linker"],
      },
    },
  };
}

function getEmbeddedSkill(skillId: string): string | null {
  const embeddedSkills: Record<string, string> = {
    "social-post-creator": `# Social Post Creator
Transformiert Pillar-Content in plattform-optimierte Social Media Posts.
## Workflow
1. Artikel analysieren → Kernaussagen extrahieren
2. Platform auswählen → LinkedIn, Instagram, TikTok, Twitter, Facebook
3. Posts generieren im JSON Format
## Output Format
{ "posts": [{ "platform": "...", "content": "...", "hashtags": [...] }] }`,
    
    "seo-content-writer": `# SEO Content Writer
Erstellt SEO-optimierte Artikel basierend auf Content Briefs.
## Workflow
1. Brief analysieren → Keywords, Intent, Zielgruppe
2. Struktur erstellen → H1/H2/H3 Hierarchie
3. Content schreiben → SEO-optimiert, E-E-A-T konform
## Output Format
{ "title": "...", "contentMarkdown": "...", "metaTitle": "...", "metaDescription": "..." }`,
  };
  
  return embeddedSkills[skillId] || null;
}

export default {
  loadSkillRegistry,
  getSkillSummaries,
  loadSkillDocument,
  loadSupportingDocument,
  loadFullSkillContext,
  getSkillsByCategory,
  skillExists,
  getSkillTokenEstimate,
};
