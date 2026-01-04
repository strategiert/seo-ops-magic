/**
 * Intelligent Model Router
 * Wählt automatisch das beste AI-Model basierend auf dem Task.
 *
 * STRATEGIE:
 * - Gemini 2.5 Pro für Content-Erstellung & Brand-Analyse (beste Qualität)
 * - Gemini 2.5 Flash für HTML, Code, Recherche (schnell + intelligent)
 * - Gemini 2.5 Flash-Lite für einfache Tasks (Kosten sparen, 25x günstiger!)
 * - Gemini 2.0 Flash (Nano Banana) für Bildgenerierung
 */

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskType =
  // PREMIUM → Gemini 2.5 Pro
  | "article_generation"      // Lange Artikel schreiben
  | "brand_analysis"          // Brand-Daten extrahieren
  // BALANCED → Gemini 2.5 Flash
  | "html_design"             // HTML/CSS generieren
  | "code_generation"         // Code schreiben
  | "competitor_research"     // Recherche
  // BUDGET → Gemini 2.5 Flash-Lite
  | "translation"             // Übersetzungen
  | "summarization"           // Zusammenfassungen
  | "simple_completion"       // Kurze, einfache Aufgaben
  | "validation"              // Daten validieren
  // IMAGE → Gemini 2.0 Flash (Nano Banana)
  | "image_generation";       // Bilder erstellen

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export type ModelId =
  // === GEMINI 2.5 PRO (Beste Qualität - für Content) ===
  | "gemini-2.5-pro"              // Artikel, Brand-Analyse ($1.25/$10.00 per 1M token)
  // === GEMINI 2.5 FLASH (Balanced) ===
  | "gemini-2.5-flash"            // HTML, Code, Recherche ($0.30/$2.50 per 1M token)
  // === GEMINI 2.5 FLASH-LITE (Budget) ===
  | "gemini-2.5-flash-lite"       // Übersetzung, Summary ($0.10/$0.40 per 1M token)
  // === NANO BANANA (Bildgenerierung) ===
  | "gemini-2.0-flash-exp";       // Bildgenerierung ($0.04 per image)

// ============================================================================
// COST TRACKING
// ============================================================================

/** Kosten pro 1M Token (USD) */
export const MODEL_COSTS: Record<ModelId, { input: number; output: number; perImage?: number }> = {
  // Gemini 2.5 Pro (Premium - beste Qualität)
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
  // Gemini 2.5 Flash (Balanced)
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  // Gemini 2.5 Flash-Lite (Budget)
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  // Nano Banana (Bildgenerierung - experimentell)
  "gemini-2.0-flash-exp": { input: 0, output: 0, perImage: 0.04 },
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
    // Balanced → Gemini 2.5 Flash
    html_design: "medium",
    code_generation: "medium",
    competitor_research: "medium",
    // Budget → Gemini 2.5 Flash-Lite
    translation: "low",
    summarization: "low",
    simple_completion: "low",
    validation: "low",
    // Image → Nano Banana
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
  // GEMINI 2.5 PRO: Content-Erstellung (beste Qualität)
  // ═══════════════════════════════════════════════════════════════════════════
  if (taskType === "article_generation" || taskType === "brand_analysis") {
    const model: ModelId = "gemini-2.5-pro";
    return {
      model,
      maxTokens: Math.min(estimatedOutputTokens * 1.5, 16000),
      temperature: taskType === "article_generation" ? 0.7 : 0.3,
      reasoning: `${taskType} → Gemini 2.5 Pro für beste Content-Qualität`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "premium",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NANO BANANA: Bildgenerierung
  // ═══════════════════════════════════════════════════════════════════════════
  if (taskType === "image_generation") {
    return {
      model: "gemini-2.0-flash-exp",
      maxTokens: 1000,
      temperature: 0.8,
      reasoning: "Bildgenerierung → Nano Banana (experimentell)",
      tier: "image",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 2.5 FLASH: HTML, Code, Recherche (schnell + intelligent)
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    taskType === "html_design" ||
    taskType === "code_generation" ||
    taskType === "competitor_research"
  ) {
    const model: ModelId = "gemini-2.5-flash";
    return {
      model,
      maxTokens: Math.min(estimatedOutputTokens * 1.5, 8000),
      temperature: taskType === "html_design" ? 0.7 : 0.4,
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
      maxTokens: Math.min(estimatedOutputTokens * 2, 4000),
      temperature: 0.3,
      reasoning: `${taskType} → Gemini 2.5 Flash-Lite (30x günstiger!)`,
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
    const tier = options.forceModel.includes("3-pro") ? "premium" :
                 options.forceModel.includes("lite") ? "budget" :
                 options.forceModel.includes("image") ? "image" : "balanced";
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
