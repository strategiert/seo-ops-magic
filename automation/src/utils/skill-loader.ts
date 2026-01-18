import * as fs from 'fs';
import * as path from 'path';

/**
 * Skill Registry Entry
 */
export interface SkillRegistryEntry {
  summary: string;
  entryPoint: string;
  supportingDocs: string[];
  category: string;
  estimatedTokens: number;
}

/**
 * Category Entry
 */
export interface CategoryEntry {
  description: string;
  skills: string[];
}

/**
 * Skill Registry Structure
 */
export interface SkillRegistry {
  version: string;
  description: string;
  skills: Record<string, SkillRegistryEntry>;
  categories: Record<string, CategoryEntry>;
  loadingStrategy: {
    router: {
      loadsOnInit: string[];
      accessibleData: string[];
    };
    specialist: {
      loadsOnInit: string[];
      loadsOnDemand: string[];
      accessibleData: string[];
    };
  };
}

/**
 * Cached skill content
 */
interface SkillCache {
  [key: string]: {
    content: string;
    loadedAt: number;
    ttl: number;
  };
}

// Cache for loaded skills
const skillCache: SkillCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default skills root path
const DEFAULT_SKILLS_ROOT = path.join(process.cwd(), '.claude', 'skills');

/**
 * Load the skill registry from REGISTRY.json
 */
export function loadSkillRegistry(skillsRoot: string = DEFAULT_SKILLS_ROOT): SkillRegistry {
  const registryPath = path.join(skillsRoot, 'REGISTRY.json');

  if (!fs.existsSync(registryPath)) {
    throw new Error(`Skill registry not found at: ${registryPath}`);
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  return JSON.parse(content) as SkillRegistry;
}

/**
 * Get all skill names from registry
 */
export function getSkillNames(registry: SkillRegistry): string[] {
  return Object.keys(registry.skills);
}

/**
 * Get skill summary (for router - minimal tokens)
 */
export function getSkillSummary(registry: SkillRegistry, skillName: string): string {
  const skill = registry.skills[skillName];
  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  return skill.summary;
}

/**
 * Get all skill summaries (for router overview)
 */
export function getAllSkillSummaries(registry: SkillRegistry): Record<string, string> {
  const summaries: Record<string, string> = {};
  for (const [name, skill] of Object.entries(registry.skills)) {
    summaries[name] = skill.summary;
  }
  return summaries;
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(registry: SkillRegistry, category: string): string[] {
  const cat = registry.categories[category];
  if (!cat) {
    throw new Error(`Category not found: ${category}`);
  }
  return cat.skills;
}

/**
 * Get all categories
 */
export function getAllCategories(registry: SkillRegistry): string[] {
  return Object.keys(registry.categories);
}

/**
 * Load skill main document (SKILL.md)
 * Uses caching to reduce file reads
 */
export async function loadSkillDocument(
  skillName: string,
  skillsRoot: string = DEFAULT_SKILLS_ROOT
): Promise<string> {
  const cacheKey = `${skillName}/SKILL.md`;

  // Check cache
  if (skillCache[cacheKey]) {
    const cached = skillCache[cacheKey];
    if (Date.now() - cached.loadedAt < cached.ttl) {
      return cached.content;
    }
  }

  const skillPath = path.join(skillsRoot, skillName, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill document not found: ${skillPath}`);
  }

  const content = fs.readFileSync(skillPath, 'utf-8');

  // Cache it
  skillCache[cacheKey] = {
    content,
    loadedAt: Date.now(),
    ttl: CACHE_TTL
  };

  return content;
}

/**
 * Load a supporting document for a skill
 * Only loaded when specifically needed
 */
export async function loadSupportingDocument(
  skillName: string,
  docName: string,
  skillsRoot: string = DEFAULT_SKILLS_ROOT
): Promise<string> {
  const cacheKey = `${skillName}/${docName}`;

  // Check cache
  if (skillCache[cacheKey]) {
    const cached = skillCache[cacheKey];
    if (Date.now() - cached.loadedAt < cached.ttl) {
      return cached.content;
    }
  }

  const docPath = path.join(skillsRoot, skillName, docName);

  if (!fs.existsSync(docPath)) {
    throw new Error(`Supporting document not found: ${docPath}`);
  }

  const content = fs.readFileSync(docPath, 'utf-8');

  // Cache it
  skillCache[cacheKey] = {
    content,
    loadedAt: Date.now(),
    ttl: CACHE_TTL
  };

  return content;
}

/**
 * Clear the skill cache
 */
export function clearSkillCache(): void {
  for (const key of Object.keys(skillCache)) {
    delete skillCache[key];
  }
}

/**
 * Get estimated tokens for a skill
 */
export function getEstimatedTokens(registry: SkillRegistry, skillName: string): number {
  const skill = registry.skills[skillName];
  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  return skill.estimatedTokens;
}

/**
 * Validate that all skills in registry have their entry point files
 */
export function validateSkillFiles(
  registry: SkillRegistry,
  skillsRoot: string = DEFAULT_SKILLS_ROOT
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [skillName, skill] of Object.entries(registry.skills)) {
    const skillDir = path.join(skillsRoot, skillName);

    // Check skill directory exists
    if (!fs.existsSync(skillDir)) {
      errors.push(`Skill directory missing: ${skillName}`);
      continue;
    }

    // Check entry point exists
    const entryPointPath = path.join(skillDir, skill.entryPoint);
    if (!fs.existsSync(entryPointPath)) {
      errors.push(`Entry point missing for ${skillName}: ${skill.entryPoint}`);
    }

    // Check supporting docs exist
    for (const doc of skill.supportingDocs) {
      const docPath = path.join(skillDir, doc);
      if (!fs.existsSync(docPath)) {
        errors.push(`Supporting doc missing for ${skillName}: ${doc}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse skill frontmatter from SKILL.md
 * Handles both Unix (\n) and Windows (\r\n) line endings
 */
export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n');

  const frontmatterMatch = normalizedContent.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const result: { name?: string; description?: string } = {};

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
  }

  // Description can span multiple lines until the next key or end of frontmatter
  const descMatch = frontmatter.match(/^description:\s*(.+(?:\n(?![\w-]+:).+)*)$/m);
  if (descMatch) {
    // Join multi-line descriptions, removing extra whitespace
    result.description = descMatch[1].replace(/\s+/g, ' ').trim();
  }

  return result;
}
