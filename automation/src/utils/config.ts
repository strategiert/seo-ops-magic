import dotenv from 'dotenv';
import { AutomationConfig } from '../types';

// Load environment variables
dotenv.config();

export function loadConfig(): AutomationConfig {
  const requiredEnvVars = [
    'WORDPRESS_URL',
    'WORDPRESS_USERNAME',
    'WORDPRESS_APP_PASSWORD',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Determine LLM provider
  let llmProvider: 'anthropic' | 'openai' = 'anthropic';
  let llmApiKey = process.env.ANTHROPIC_API_KEY;

  if (!llmApiKey && process.env.OPENAI_API_KEY) {
    llmProvider = 'openai';
    llmApiKey = process.env.OPENAI_API_KEY;
  }

  if (!llmApiKey) {
    throw new Error('Either ANTHROPIC_API_KEY or OPENAI_API_KEY must be set');
  }

  return {
    wordpress: {
      url: process.env.WORDPRESS_URL!,
      username: process.env.WORDPRESS_USERNAME!,
      appPassword: process.env.WORDPRESS_APP_PASSWORD!,
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    llm: {
      provider: llmProvider,
      apiKey: llmApiKey,
      model: process.env.LLM_MODEL,
    },
    multilingual: {
      defaultLanguage: process.env.DEFAULT_LANGUAGE || 'de',
      supportedLanguages: process.env.SUPPORTED_LANGUAGES?.split(',') || ['de'],
    },
  };
}
