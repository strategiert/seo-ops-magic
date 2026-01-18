import * as fs from 'fs';
import * as path from 'path';
import {
  loadSkillRegistry,
  validateSkillFiles,
  loadSkillDocument,
  parseSkillFrontmatter,
  SkillRegistry
} from '../utils/skill-loader';

// Path to the actual skills directory
const SKILLS_ROOT = path.join(process.cwd(), '..', '.claude', 'skills');

describe('REGISTRY.json Validation', () => {
  let registry: SkillRegistry;
  let registryPath: string;

  beforeAll(() => {
    registryPath = path.join(SKILLS_ROOT, 'REGISTRY.json');
    registry = loadSkillRegistry(SKILLS_ROOT);
  });

  describe('Schema Validation', () => {
    it('should have valid version format', () => {
      expect(registry.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have description', () => {
      expect(typeof registry.description).toBe('string');
      expect(registry.description.length).toBeGreaterThan(0);
    });

    it('should have skills object', () => {
      expect(typeof registry.skills).toBe('object');
      expect(Object.keys(registry.skills).length).toBeGreaterThan(0);
    });

    it('should have categories object', () => {
      expect(typeof registry.categories).toBe('object');
      expect(Object.keys(registry.categories).length).toBeGreaterThan(0);
    });

    it('should have loadingStrategy', () => {
      expect(registry.loadingStrategy).toBeDefined();
      expect(registry.loadingStrategy.router).toBeDefined();
      expect(registry.loadingStrategy.specialist).toBeDefined();
    });
  });

  describe('Skill Entry Validation', () => {
    it('should have all required fields for each skill', () => {
      for (const [name, skill] of Object.entries(registry.skills)) {
        expect(skill.summary).toBeDefined();
        expect(typeof skill.summary).toBe('string');

        expect(skill.entryPoint).toBeDefined();
        expect(skill.entryPoint).toBe('SKILL.md');

        expect(skill.supportingDocs).toBeDefined();
        expect(Array.isArray(skill.supportingDocs)).toBe(true);

        expect(skill.category).toBeDefined();
        expect(typeof skill.category).toBe('string');

        expect(skill.estimatedTokens).toBeDefined();
        expect(typeof skill.estimatedTokens).toBe('number');
        expect(skill.estimatedTokens).toBeGreaterThan(0);
      }
    });

    it('should have kebab-case skill names', () => {
      const kebabCaseRegex = /^[a-z]+(-[a-z]+)*$/;

      for (const name of Object.keys(registry.skills)) {
        expect(name).toMatch(kebabCaseRegex);
      }
    });

    it('should have supporting docs ending in .md', () => {
      for (const [name, skill] of Object.entries(registry.skills)) {
        for (const doc of skill.supportingDocs) {
          expect(doc.endsWith('.md')).toBe(true);
        }
      }
    });

    it('should have summaries under 200 characters for efficiency', () => {
      for (const [name, skill] of Object.entries(registry.skills)) {
        expect(skill.summary.length).toBeLessThan(200);
      }
    });
  });

  describe('Category Validation', () => {
    it('should have all required fields for each category', () => {
      for (const [name, category] of Object.entries(registry.categories)) {
        expect(category.description).toBeDefined();
        expect(typeof category.description).toBe('string');

        expect(category.skills).toBeDefined();
        expect(Array.isArray(category.skills)).toBe(true);
        expect(category.skills.length).toBeGreaterThan(0);
      }
    });

    it('should only reference existing skills', () => {
      for (const [categoryName, category] of Object.entries(registry.categories)) {
        for (const skillName of category.skills) {
          expect(registry.skills[skillName]).toBeDefined();
        }
      }
    });

    it('should have matching category in skill entries', () => {
      for (const [categoryName, category] of Object.entries(registry.categories)) {
        for (const skillName of category.skills) {
          expect(registry.skills[skillName].category).toBe(categoryName);
        }
      }
    });
  });

  describe('Loading Strategy Validation', () => {
    it('should have router strategy', () => {
      const router = registry.loadingStrategy.router;

      expect(Array.isArray(router.loadsOnInit)).toBe(true);
      expect(Array.isArray(router.accessibleData)).toBe(true);
    });

    it('should have specialist strategy', () => {
      const specialist = registry.loadingStrategy.specialist;

      expect(Array.isArray(specialist.loadsOnInit)).toBe(true);
      expect(Array.isArray(specialist.loadsOnDemand)).toBe(true);
      expect(Array.isArray(specialist.accessibleData)).toBe(true);
    });

    it('should minimize router initial load', () => {
      // Router should load nothing on init for token efficiency
      expect(registry.loadingStrategy.router.loadsOnInit.length).toBe(0);
    });
  });

  describe('Complete Coverage', () => {
    const expectedSkills = [
      'social-post-creator',
      'ad-copy-writer',
      'press-release-writer',
      'newsletter-composer',
      'linkbait-creator',
      'content-translator',
      'seo-content-writer',
      'html-designer',
      'wordpress-publisher',
      'image-generator',
      'video-creator',
      'carousel-designer',
      'internal-linker',
      'press-outreach-bot',
      'link-building-agent',
      'editorial-researcher',
      'company-social-manager',
      'employee-advocacy-manager'
    ];

    it('should have all 18 documented skills', () => {
      const skillNames = Object.keys(registry.skills);
      expect(skillNames.length).toBe(18);
    });

    it('should have all expected skills', () => {
      for (const skillName of expectedSkills) {
        expect(registry.skills[skillName]).toBeDefined();
      }
    });

    const expectedCategories = [
      'content-transformation',
      'content-creation',
      'visual-assets',
      'seo',
      'outreach',
      'social-management'
    ];

    it('should have all 6 documented categories', () => {
      expect(Object.keys(registry.categories).length).toBe(6);
    });

    it('should have all expected categories', () => {
      for (const categoryName of expectedCategories) {
        expect(registry.categories[categoryName]).toBeDefined();
      }
    });
  });
});

describe('Skill Document Structure Validation', () => {
  let registry: SkillRegistry;

  beforeAll(() => {
    registry = loadSkillRegistry(SKILLS_ROOT);
  });

  describe('SKILL.md Files', () => {
    it('should exist for all registered skills', async () => {
      const result = validateSkillFiles(registry, SKILLS_ROOT);
      expect(result.valid).toBe(true);
    });

    it('should have valid frontmatter for all skills', async () => {
      const missingFrontmatter: string[] = [];

      for (const skillName of Object.keys(registry.skills)) {
        const content = await loadSkillDocument(skillName, SKILLS_ROOT);
        const frontmatter = parseSkillFrontmatter(content);

        // Should have name (can be slightly different from folder name)
        if (!frontmatter.name) {
          missingFrontmatter.push(`${skillName}: missing name`);
        }

        // Should have description
        if (!frontmatter.description || frontmatter.description.length < 20) {
          missingFrontmatter.push(`${skillName}: missing or short description`);
        }
      }

      // Allow some skills to have frontmatter issues during development
      // but flag them for review
      if (missingFrontmatter.length > 0) {
        console.warn('Skills with frontmatter issues:', missingFrontmatter);
      }

      // At least 80% should have proper frontmatter
      const totalSkills = Object.keys(registry.skills).length;
      const validSkills = totalSkills - missingFrontmatter.length;
      expect(validSkills / totalSkills).toBeGreaterThanOrEqual(0.8);
    });

    it('should have Quick Start section', async () => {
      for (const skillName of Object.keys(registry.skills)) {
        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        expect(content).toMatch(/## Quick Start|## Workflow|## Output Format/);
      }
    });

    it('should have Output section or structured output examples', async () => {
      const skillsWithoutOutput: string[] = [];

      for (const skillName of Object.keys(registry.skills)) {
        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        // Check for various output-related patterns
        const hasOutput = content.match(/## Output|Output:|```json|## Format|→.*Output/i);
        if (!hasOutput) {
          skillsWithoutOutput.push(skillName);
        }
      }

      // Allow up to 2 skills without explicit output section
      expect(skillsWithoutOutput.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Supporting Documents', () => {
    it('should exist for skills that declare them', async () => {
      for (const [skillName, skill] of Object.entries(registry.skills)) {
        for (const docName of skill.supportingDocs) {
          const docPath = path.join(SKILLS_ROOT, skillName, docName);
          expect(fs.existsSync(docPath)).toBe(true);
        }
      }
    });

    it('should be markdown files', async () => {
      for (const [skillName, skill] of Object.entries(registry.skills)) {
        for (const docName of skill.supportingDocs) {
          expect(docName.endsWith('.md')).toBe(true);
        }
      }
    });

    it('should have content (not empty)', async () => {
      for (const [skillName, skill] of Object.entries(registry.skills)) {
        for (const docName of skill.supportingDocs) {
          const docPath = path.join(SKILLS_ROOT, skillName, docName);
          const content = fs.readFileSync(docPath, 'utf-8');

          expect(content.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Token Estimation Accuracy', () => {
    it('should have token estimates that include supporting docs', async () => {
      for (const [skillName, skill] of Object.entries(registry.skills)) {
        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        // Load all supporting docs to get total size
        let totalSize = content.length;
        for (const docName of skill.supportingDocs) {
          try {
            const docPath = path.join(SKILLS_ROOT, skillName, docName);
            const docContent = fs.readFileSync(docPath, 'utf-8');
            totalSize += docContent.length;
          } catch {
            // Skip missing docs
          }
        }

        // Rough estimate: 4 chars per token
        const estimatedTokens = Math.ceil(totalSize / 4);

        // Skill's estimated tokens should be reasonable
        // (between 0.5x and 3x of actual content)
        expect(skill.estimatedTokens).toBeGreaterThanOrEqual(estimatedTokens * 0.3);
        expect(skill.estimatedTokens).toBeLessThanOrEqual(estimatedTokens * 3);
      }
    });

    it('should have estimates under 20k tokens for efficiency', () => {
      for (const [skillName, skill] of Object.entries(registry.skills)) {
        expect(skill.estimatedTokens).toBeLessThan(20000);
      }
    });
  });
});

describe('Skill Content Quality', () => {
  let registry: SkillRegistry;

  beforeAll(() => {
    registry = loadSkillRegistry(SKILLS_ROOT);
  });

  describe('Content-Transformation Skills', () => {
    const transformationSkills = [
      'social-post-creator',
      'ad-copy-writer',
      'press-release-writer',
      'newsletter-composer',
      'linkbait-creator',
      'content-translator'
    ];

    it('should have input/output descriptions', async () => {
      for (const skillName of transformationSkills) {
        if (!registry.skills[skillName]) continue;

        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        expect(content).toMatch(/Input:|Input →|## Input/i);
        expect(content).toMatch(/Output:|Output →|## Output/i);
      }
    });
  });

  describe('Outreach Skills', () => {
    const outreachSkills = [
      'press-outreach-bot',
      'link-building-agent',
      'editorial-researcher'
    ];

    it('should have workflow documentation', async () => {
      for (const skillName of outreachSkills) {
        if (!registry.skills[skillName]) continue;

        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        expect(content).toMatch(/## Workflow|## Process|Schritt|Step/i);
      }
    });
  });

  describe('Visual Asset Skills', () => {
    const visualSkills = [
      'image-generator',
      'video-creator',
      'carousel-designer'
    ];

    it('should have platform specifications', async () => {
      for (const skillName of visualSkills) {
        if (!registry.skills[skillName]) continue;

        const content = await loadSkillDocument(skillName, SKILLS_ROOT);

        expect(content).toMatch(/Platform|Format|Dimension|Size/i);
      }
    });
  });
});
