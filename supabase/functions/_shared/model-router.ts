/**
 * Intelligent Model Router
 * Wählt automatisch das beste AI-Model basierend auf dem Task.
 *
 * AKTUELLE MODELLE (Stand: Januar 2026):
 * - gemini-2.5-flash-lite → Budget Tasks (Übersetzung, Summary)
 * - gemini-2.5-flash → Balanced Tasks (Code, Recherche)
 * - gemini-2.5-pro → Premium Tasks (Artikel, Brand-Analyse, HTML)
 */

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskType =
  // PREMIUM → Gemini 2.5 Pro
  | "article_generation"      // Lange Artikel schreiben
  | "brand_analysis"          // Brand-Daten extrahieren
  | "html_design"             // HTML/CSS generieren (braucht viel Output)
  // BALANCED → Gemini 2.5 Flash
  | "code_generation"         // Code schreiben
  | "competitor_research"     // Recherche
  // BUDGET → Gemini 2.5 Flash-Lite
  | "translation"             // Übersetzungen
  | "summarization"           // Zusammenfassungen
  | "simple_completion"       // Kurze, einfache Aufgaben
  | "validation"              // Daten validieren
  // IMAGE → Imagen 3
  | "image_generation";       // Bilder erstellen

// ============================================================================
// MODEL DEFINITIONS (Korrekte Namen für Google AI API)
// ============================================================================

export type ModelId =
  // === GEMINI 2.5 PRO (Premium - beste Qualität) ===
  | "gemini-2.5-pro"              // Artikel, Brand-Analyse, HTML
  // === GEMINI 2.5 FLASH (Balanced) ===
  | "gemini-2.5-flash"            // Code, Recherche
  // === GEMINI 2.5 FLASH-LITE (Budget) ===
  | "gemini-2.5-flash-lite"       // Übersetzung, Summary
  // === IMAGEN 3 (Bildgenerierung) ===
  | "imagen-3";                   // Bildgenerierung

// ============================================================================
// COST TRACKING
// ============================================================================

/** Kosten pro 1M Token (USD) */
export const MODEL_COSTS: Record<ModelId, { input: number; output: number; perImage?: number }> = {
  // Gemini 2.5 Pro (Premium)
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
  // Gemini 2.5 Flash (Balanced)
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  // Gemini 2.5 Flash-Lite (Budget)
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  // Imagen 3 (Bildgenerierung)
  "imagen-3": { input: 0, output: 0, perImage: 0.03 },
};

/** Berechnet geschätzte Kosten für einen Request */
export function calculateCost(
  model: ModelId,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const costs = MODEL_COSTS[model];
  const inputCost = (estimatedInputTokens / 1_000_000) * costs.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * costs.output;
  return {
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round((inputCost + outputCost) * 10000) / 10000,
  };
}

// ============================================================================
// MODEL CONFIG
// ============================================================================

export interface ModelConfig {
  model: ModelId;
  maxTokens: number;
  temperature: number;
  reasoning: string;
  estimatedCost?: { inputCost: number; outputCost: number; totalCost: number };
  tier: "premium" | "balanced" | "budget" | "image";
}

export interface TaskAnalysis {
  taskType: TaskType;
  complexity: "low" | "medium" | "high";
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

// ============================================================================
// TASK ANALYSIS
// ============================================================================

export function analyzeTask(
  taskType: TaskType,
  promptLength: number,
  additionalContext?: {
    targetLength?: number;
    requiresStructuredOutput?: boolean;
  }
): TaskAnalysis {
  const ctx = additionalContext || {};

  const baseComplexity: Record<TaskType, "low" | "medium" | "high"> = {
    // Premium → Gemini 2.5 Pro
    article_generation: "high",
    brand_analysis: "high",
    html_design: "high",
    // Balanced → Gemini 2.5 Flash
    code_generation: "medium",
    competitor_research: "medium",
    // Budget → Gemini 2.5 Flash-Lite
    translation: "low",
    summarization: "low",
    simple_completion: "low",
    validation: "low",
    // Image → Imagen 3
    image_generation: "medium",
  };

  const complexity = baseComplexity[taskType];
  const estimatedInputTokens = Math.ceil(promptLength / 4);
  const estimatedOutputTokens = ctx.targetLength
    ? Math.ceil(ctx.targetLength * 1.3)
    : complexity === "low" ? 500 : complexity === "medium" ? 2000 : 6000;

  return { taskType, complexity, estimatedInputTokens, estimatedOutputTokens };
}

// ============================================================================
// MODEL SELECTION
// ============================================================================

export function selectModel(analysis: TaskAnalysis): ModelConfig {
  const { taskType, estimatedInputTokens, estimatedOutputTokens } = analysis;

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 2.5 PRO: Artikel, Brand-Analyse, HTML Design (beste Qualität)
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    taskType === "article_generation" ||
    taskType === "brand_analysis" ||
    taskType === "html_design"
  ) {
    const model: ModelId = "gemini-2.5-pro";

    // HTML und Artikel brauchen viel Output
    let maxTokens: number;
    if (taskType === "html_design") {
      maxTokens = 16000; // HTML-Seiten brauchen viel Platz
    } else if (taskType === "article_generation") {
      maxTokens = Math.min(Math.max(estimatedOutputTokens * 1.5, 12000), 16000);
    } else {
      maxTokens = Math.min(estimatedOutputTokens * 1.5, 8000);
    }

    return {
      model,
      maxTokens: Math.floor(maxTokens),
      temperature: taskType === "brand_analysis" ? 0.3 : 0.7,
      reasoning: `${taskType} → Gemini 2.5 Pro für maximale Qualität`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "premium",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGEN 3: Bildgenerierung
  // ═══════════════════════════════════════════════════════════════════════════
  if (taskType === "image_generation") {
    return {
      model: "imagen-3",
      maxTokens: 1000,
      temperature: 0.8,
      reasoning: "Bildgenerierung → Imagen 3",
      tier: "image",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 2.5 FLASH: Code, Recherche (schnell + intelligent)
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    taskType === "code_generation" ||
    taskType === "competitor_research"
  ) {
    const model: ModelId = "gemini-2.5-flash";
    return {
      model,
      maxTokens: Math.floor(Math.min(estimatedOutputTokens * 1.5, 8000)),
      temperature: 0.4,
      reasoning: `${taskType} → Gemini 2.5 Flash (schnell + intelligent)`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "balanced",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 2.5 FLASH-LITE: Einfache Tasks (maximale Kostenersparnis)
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    taskType === "translation" ||
    taskType === "summarization" ||
    taskType === "simple_completion" ||
    taskType === "validation"
  ) {
    const model: ModelId = "gemini-2.5-flash-lite";
    return {
      model,
      maxTokens: Math.floor(Math.min(estimatedOutputTokens * 2, 4000)),
      temperature: 0.3,
      reasoning: `${taskType} → Gemini 2.5 Flash-Lite (günstig!)`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "budget",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Gemini 2.5 Flash
  // ═══════════════════════════════════════════════════════════════════════════
  const model: ModelId = "gemini-2.5-flash";
  return {
    model,
    maxTokens: 4000,
    temperature: 0.5,
    reasoning: "Fallback → Gemini 2.5 Flash",
    estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
    tier: "balanced",
  };
}

// ============================================================================
// MAIN ROUTING FUNCTION
// ============================================================================

export function routeToModel(
  taskType: TaskType,
  prompt: string,
  options?: {
    targetLength?: number;
    requiresStructuredOutput?: boolean;
    forceModel?: ModelId;
  }
): ModelConfig {
  if (options?.forceModel) {
    const tier = options.forceModel.includes("pro") ? "premium" :
                 options.forceModel.includes("lite") ? "budget" :
                 options.forceModel.includes("imagen") ? "image" : "balanced";
    return {
      model: options.forceModel,
      maxTokens: 8000,
      temperature: 0.5,
      reasoning: `Manuell gewählt: ${options.forceModel}`,
      tier,
    };
  }

  const analysis = analyzeTask(taskType, prompt.length, options);
  const config = selectModel(analysis);

  console.log(`[ModelRouter] ═══════════════════════════════════════`);
  console.log(`[ModelRouter] Task: ${taskType}`);
  console.log(`[ModelRouter] Model: ${config.model} (${config.tier})`);
  console.log(`[ModelRouter] MaxTokens: ${config.maxTokens}`);
  console.log(`[ModelRouter] ${config.reasoning}`);
  if (config.estimatedCost) {
    console.log(`[ModelRouter] Est. Cost: $${config.estimatedCost.totalCost}`);
  }
  console.log(`[ModelRouter] ═══════════════════════════════════════`);

  return config;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export function getGeminiEndpoint(path: string = "/chat/completions"): string {
  return `${GEMINI_API_BASE}${path}`;
}
