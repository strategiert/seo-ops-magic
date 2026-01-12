import dotenv from 'dotenv';
import { AutomationConfig } from '../types';

// Load environment variables
dotenv.config();

export function loadConfig(): AutomationConfig {
  // WordPress credentials must be configured by the user
  const userConfiguredVars = [
    'WORDPRESS_URL',
    'WORDPRESS_USERNAME',
    'WORDPRESS_APP_PASSWORD',
  ];

  // System variables (globally available)
  const systemVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missingUserVars = userConfiguredVars.filter((varName) => !process.env[varName]);
  const missingSystemVars = systemVars.filter((varName) => !process.env[varName]);

  if (missingUserVars.length > 0) {
    console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚠️  WORDPRESS NICHT KONFIGURIERT                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Fehlende WordPress-Einstellungen:                                           ║
║  ${missingUserVars.map(v => `• ${v}`).join('\n║  ').padEnd(74)}║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  📋 SO BEHEBST DU DEN FEHLER:                                                ║
║                                                                              ║
║  1. Gehe zu: GitHub → Repository → Settings → Secrets and variables         ║
║     → Actions → New repository secret                                        ║
║                                                                              ║
║  2. Füge diese Secrets hinzu:                                                ║
║     • WORDPRESS_URL          → z.B. https://deine-seite.de                  ║
║     • WORDPRESS_USERNAME     → Dein WordPress Benutzername                  ║
║     • WORDPRESS_APP_PASSWORD → App-Passwort (nicht Login-Passwort!)         ║
║                                                                              ║
║  💡 WordPress App-Passwort erstellen:                                        ║
║     WordPress Admin → Benutzer → Profil → App-Passwörter                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
    throw new Error(`WordPress nicht konfiguriert. Fehlend: ${missingUserVars.join(', ')}`);
  }

  if (missingSystemVars.length > 0) {
    // This should not happen in production - system error
    throw new Error(`System configuration error: ${missingSystemVars.join(', ')}`);
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
