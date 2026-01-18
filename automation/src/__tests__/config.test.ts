import { loadConfig } from '../utils/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setRequiredEnvVars = () => {
    process.env.WORDPRESS_URL = 'https://example.com';
    process.env.WORDPRESS_USERNAME = 'admin';
    process.env.WORDPRESS_APP_PASSWORD = 'xxxx-xxxx-xxxx-xxxx';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
  };

  describe('required environment variables', () => {
    it('should throw error when WORDPRESS_URL is missing', () => {
      process.env.WORDPRESS_USERNAME = 'admin';
      process.env.WORDPRESS_APP_PASSWORD = 'pass';
      process.env.SUPABASE_URL = 'https://x.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
      process.env.ANTHROPIC_API_KEY = 'key';

      expect(() => loadConfig()).toThrow('WordPress nicht konfiguriert. Fehlend: WORDPRESS_URL');
    });

    it('should throw error when multiple vars are missing', () => {
      process.env.ANTHROPIC_API_KEY = 'key';

      expect(() => loadConfig()).toThrow('WordPress nicht konfiguriert');
    });

    it('should throw error when no LLM API key is set', () => {
      process.env.WORDPRESS_URL = 'https://example.com';
      process.env.WORDPRESS_USERNAME = 'admin';
      process.env.WORDPRESS_APP_PASSWORD = 'pass';
      process.env.SUPABASE_URL = 'https://x.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

      expect(() => loadConfig()).toThrow('Either ANTHROPIC_API_KEY or OPENAI_API_KEY must be set');
    });
  });

  describe('successful configuration', () => {
    beforeEach(() => {
      setRequiredEnvVars();
    });

    it('should load WordPress config correctly', () => {
      const config = loadConfig();

      expect(config.wordpress.url).toBe('https://example.com');
      expect(config.wordpress.username).toBe('admin');
      expect(config.wordpress.appPassword).toBe('xxxx-xxxx-xxxx-xxxx');
    });

    it('should load Supabase config correctly', () => {
      const config = loadConfig();

      expect(config.supabase.url).toBe('https://project.supabase.co');
      expect(config.supabase.serviceRoleKey).toBe('service-role-key');
    });

    it('should prefer Anthropic when both LLM keys are set', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      const config = loadConfig();

      expect(config.llm.provider).toBe('anthropic');
      expect(config.llm.apiKey).toBe('anthropic-key');
    });

    it('should use OpenAI when only OpenAI key is set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'openai-key';
      const config = loadConfig();

      expect(config.llm.provider).toBe('openai');
      expect(config.llm.apiKey).toBe('openai-key');
    });

    it('should use custom LLM model when set', () => {
      process.env.LLM_MODEL = 'claude-3-opus';
      const config = loadConfig();

      expect(config.llm.model).toBe('claude-3-opus');
    });

    it('should have undefined model when not set', () => {
      const config = loadConfig();

      expect(config.llm.model).toBeUndefined();
    });
  });

  describe('multilingual configuration', () => {
    beforeEach(() => {
      setRequiredEnvVars();
    });

    it('should default to German language', () => {
      const config = loadConfig();

      expect(config.multilingual.defaultLanguage).toBe('de');
    });

    it('should use custom default language when set', () => {
      process.env.DEFAULT_LANGUAGE = 'en';
      const config = loadConfig();

      expect(config.multilingual.defaultLanguage).toBe('en');
    });

    it('should default to single language array', () => {
      const config = loadConfig();

      expect(config.multilingual.supportedLanguages).toEqual(['de']);
    });

    it('should parse comma-separated languages', () => {
      process.env.SUPPORTED_LANGUAGES = 'de,en,fr';
      const config = loadConfig();

      expect(config.multilingual.supportedLanguages).toEqual(['de', 'en', 'fr']);
    });
  });
});
