import * as fs from 'fs';
import * as path from 'path';
import {
  loadSkillRegistry,
  getSkillNames,
  getSkillSummary,
  getAllSkillSummaries,
  getSkillsByCategory,
  getAllCategories,
  loadSkillDocument,
  loadSupportingDocument,
  clearSkillCache,
  getEstimatedTokens,
  validateSkillFiles,
  parseSkillFrontmatter,
  SkillRegistry
} from '../utils/skill-loader';

// Path to the actual skills directory
const SKILLS_ROOT = path.join(process.cwd(), '..', '.claude', 'skills');

describe('Skill Loader', () => {
  let registry: SkillRegistry;

  beforeAll(() => {
    // Load the actual registry
    registry = loadSkillRegistry(SKILLS_ROOT);
  });

  beforeEach(() => {
    clearSkillCache();
  });

  describe('loadSkillRegistry', () => {
    it('should load the skill registry successfully', () => {
      expect(registry).toBeDefined();
      expect(registry.version).toBe('1.0.0');
      expect(registry.skills).toBeDefined();
      expect(registry.categories).toBeDefined();
    });

    it('should throw error for non-existent registry', () => {
      expect(() => loadSkillRegistry('/non/existent/path')).toThrow('Skill registry not found');
    });

    it('should have required registry structure', () => {
      expect(registry.loadingStrategy).toBeDefined();
      expect(registry.loadingStrategy.router).toBeDefined();
      expect(registry.loadingStrategy.specialist).toBeDefined();
    });
  });

  describe('getSkillNames', () => {
    it('should return all skill names', () => {
      const names = getSkillNames(registry);

      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('social-post-creator');
      expect(names).toContain('ad-copy-writer');
      expect(names).toContain('press-release-writer');
    });

    it('should return 18 skills as documented', () => {
      const names = getSkillNames(registry);
      expect(names.length).toBe(18);
    });
  });

  describe('getSkillSummary', () => {
    it('should return summary for existing skill', () => {
      const summary = getSkillSummary(registry, 'social-post-creator');

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent skill', () => {
      expect(() => getSkillSummary(registry, 'non-existent-skill')).toThrow('Skill not found');
    });
  });

  describe('getAllSkillSummaries', () => {
    it('should return summaries for all skills', () => {
      const summaries = getAllSkillSummaries(registry);

      expect(Object.keys(summaries).length).toBe(18);
      expect(summaries['social-post-creator']).toBeDefined();
      expect(summaries['ad-copy-writer']).toBeDefined();
    });

    it('should have non-empty summaries', () => {
      const summaries = getAllSkillSummaries(registry);

      for (const summary of Object.values(summaries)) {
        expect(summary.length).toBeGreaterThan(10);
      }
    });
  });

  describe('getSkillsByCategory', () => {
    it('should return skills for content-transformation category', () => {
      const skills = getSkillsByCategory(registry, 'content-transformation');

      expect(Array.isArray(skills)).toBe(true);
      expect(skills).toContain('social-post-creator');
      expect(skills).toContain('ad-copy-writer');
      expect(skills).toContain('press-release-writer');
    });

    it('should throw error for non-existent category', () => {
      expect(() => getSkillsByCategory(registry, 'non-existent-category')).toThrow('Category not found');
    });
  });

  describe('getAllCategories', () => {
    it('should return all categories', () => {
      const categories = getAllCategories(registry);

      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('content-transformation');
      expect(categories).toContain('content-creation');
      expect(categories).toContain('visual-assets');
      expect(categories).toContain('seo');
      expect(categories).toContain('outreach');
      expect(categories).toContain('social-management');
    });

    it('should return exactly 6 categories', () => {
      const categories = getAllCategories(registry);
      expect(categories.length).toBe(6);
    });
  });

  describe('loadSkillDocument', () => {
    it('should load SKILL.md for existing skill', async () => {
      const content = await loadSkillDocument('social-post-creator', SKILLS_ROOT);

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('social-post-creator');
    });

    it('should throw error for non-existent skill', async () => {
      await expect(loadSkillDocument('non-existent', SKILLS_ROOT)).rejects.toThrow('Skill document not found');
    });

    it('should cache loaded documents', async () => {
      const content1 = await loadSkillDocument('social-post-creator', SKILLS_ROOT);
      const content2 = await loadSkillDocument('social-post-creator', SKILLS_ROOT);

      expect(content1).toBe(content2);
    });
  });

  describe('loadSupportingDocument', () => {
    it('should load supporting document for skill with docs', async () => {
      const content = await loadSupportingDocument('social-post-creator', 'PLATFORM_SPECS.md', SKILLS_ROOT);

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent document', async () => {
      await expect(
        loadSupportingDocument('social-post-creator', 'NON_EXISTENT.md', SKILLS_ROOT)
      ).rejects.toThrow('Supporting document not found');
    });
  });

  describe('getEstimatedTokens', () => {
    it('should return estimated tokens for skill', () => {
      const tokens = getEstimatedTokens(registry, 'social-post-creator');

      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should throw error for non-existent skill', () => {
      expect(() => getEstimatedTokens(registry, 'non-existent')).toThrow('Skill not found');
    });
  });

  describe('validateSkillFiles', () => {
    it('should validate all skill files exist', () => {
      const result = validateSkillFiles(registry, SKILLS_ROOT);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing files', () => {
      // Create a mock registry with non-existent files
      const mockRegistry: SkillRegistry = {
        ...registry,
        skills: {
          'fake-skill': {
            summary: 'Fake skill',
            entryPoint: 'SKILL.md',
            supportingDocs: ['FAKE.md'],
            category: 'test',
            estimatedTokens: 1000
          }
        }
      };

      const result = validateSkillFiles(mockRegistry, SKILLS_ROOT);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseSkillFrontmatter', () => {
    it('should parse frontmatter with name and description', () => {
      const content = `---
name: test-skill
description: This is a test skill for testing purposes.
---

# Test Skill

Content here...`;

      const result = parseSkillFrontmatter(content);

      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('This is a test skill for testing purposes.');
    });

    it('should return empty object for content without frontmatter', () => {
      const content = `# Test Skill

Content without frontmatter...`;

      const result = parseSkillFrontmatter(content);

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should handle partial frontmatter', () => {
      const content = `---
name: partial-skill
---

# Partial`;

      const result = parseSkillFrontmatter(content);

      expect(result.name).toBe('partial-skill');
      expect(result.description).toBeUndefined();
    });
  });

  describe('clearSkillCache', () => {
    it('should clear the cache', async () => {
      // Load a skill to populate cache
      await loadSkillDocument('social-post-creator', SKILLS_ROOT);

      // Clear cache
      clearSkillCache();

      // No direct way to verify, but this should not throw
      expect(() => clearSkillCache()).not.toThrow();
    });
  });
});

describe('Skill Registry Structure', () => {
  let registry: SkillRegistry;

  beforeAll(() => {
    registry = loadSkillRegistry(SKILLS_ROOT);
  });

  it('should have consistent skill-category mapping', () => {
    // Every skill in a category should exist in skills
    for (const [categoryName, category] of Object.entries(registry.categories)) {
      for (const skillName of category.skills) {
        expect(registry.skills[skillName]).toBeDefined();
        expect(registry.skills[skillName].category).toBe(categoryName);
      }
    }
  });

  it('should have all skills assigned to a category', () => {
    const skillsInCategories = new Set<string>();

    for (const category of Object.values(registry.categories)) {
      for (const skill of category.skills) {
        skillsInCategories.add(skill);
      }
    }

    for (const skillName of Object.keys(registry.skills)) {
      expect(skillsInCategories.has(skillName)).toBe(true);
    }
  });

  it('should have reasonable token estimates', () => {
    for (const [name, skill] of Object.entries(registry.skills)) {
      expect(skill.estimatedTokens).toBeGreaterThan(0);
      expect(skill.estimatedTokens).toBeLessThan(50000); // Sanity check
    }
  });

  it('should have SKILL.md as entry point for all skills', () => {
    for (const skill of Object.values(registry.skills)) {
      expect(skill.entryPoint).toBe('SKILL.md');
    }
  });
});
