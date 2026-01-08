/**
 * Intelligent Model Router
 * Wählt automatisch das beste AI-Model basierend auf dem Task.
 *
 * STRATEGIE:
 * - Gemini 3 Pro Preview für Content-Erstellung & Brand-Analyse (beste Qualität)
 * - Gemini 3 Flash Preview für HTML, Code, Recherche, Outline, Sections (Pro-Level, schnell)
 * - Gemini 2.5 Flash-Lite für einfache Tasks (Kosten sparen)
 * - Gemini 3 Pro Image Preview für Bildgenerierung
 */

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskType =
  // PREMIUM → Gemini 3 Pro Preview
  | "article_generation"      // Lange Artikel schreiben (ganzer Artikel auf einmal)
  | "brand_analysis"          // Brand-Daten extrahieren
  // BALANCED → Gemini 3 Flash Preview
  | "outline_generation"      // Artikel-Struktur erstellen
  | "section_writing"         // Einzelne Section schreiben
  | "html_design"             // HTML/CSS generieren
  | "code_generation"         // Code schreiben
  | "competitor_research"     // Recherche
  // BUDGET → Gemini 2.5 Flash-Lite
  | "translation"             // Übersetzungen
  | "summarization"           // Zusammenfassungen
  | "simple_completion"       // Kurze, einfache Aufgaben
  | "validation"              // Daten validieren
  | "section_review"          // Section Quality Check (schnell)
  // IMAGE → Gemini 3 Pro Image Preview
  | "image_generation";       // Bilder erstellen

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export type ModelId =
  // === GEMINI 3 PRO PREVIEW (Beste Qualität - für Content) ===
  | "gemini-3-pro-preview"         // Artikel, Brand-Analyse ($2.00/$8.00 per 1M token)
  // === GEMINI 3 FLASH PREVIEW (Balanced - Next Gen) ===
  | "gemini-3-flash-preview"       // Schnell + intelligent ($0.30/$1.00 per 1M token)
  // === GEMINI 2.5 FLASH (Balanced) ===
  | "gemini-2.5-flash"             // HTML, Code, Recherche ($0.20/$0.80 per 1M token)
  // === GEMINI 2.5 FLASH-LITE (Budget) ===
  | "gemini-2.5-flash-lite"        // Übersetzung, Summary ($0.10/$0.40 per 1M token)
  // === GEMINI 3 PRO IMAGE PREVIEW (Bildgenerierung) ===
  | "gemini-3-pro-image-preview";  // Bildgenerierung ($0.04 per image)

// ============================================================================
// COST TRACKING
// ============================================================================

/** Kosten pro 1M Token (USD) */
export const MODEL_COSTS: Record<ModelId, { input: number; output: number; perImage?: number }> = {
  // Gemini 3 Pro Preview (Premium - beste Qualität)
  "gemini-3-pro-preview": { input: 2.00, output: 8.00 },
  // Gemini 3 Flash Preview (Next-Gen Balanced)
  "gemini-3-flash-preview": { input: 0.30, output: 1.00 },
  // Gemini 2.5 Flash (Balanced)
  "gemini-2.5-flash": { input: 0.20, output: 0.80 },
  // Gemini 2.5 Flash-Lite (Budget)
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  // Gemini 3 Pro Image Preview (Bildgenerierung)
  "gemini-3-pro-image-preview": { input: 0, output: 0, perImage: 0.04 },
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
    // Premium → Gemini 3 Pro Preview
    article_generation: "high",
    brand_analysis: "high",
    // Balanced → Gemini 3 Flash Preview
    outline_generation: "medium",
    section_writing: "medium",
    html_design: "medium",
    code_generation: "medium",
    competitor_research: "medium",
    // Budget → Gemini 2.5 Flash-Lite
    translation: "low",
    summarization: "low",
    simple_completion: "low",
    validation: "low",
    section_review: "low",
    // Image → Gemini 3 Pro Image Preview
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
  // GEMINI 3 PRO PREVIEW: Content-Erstellung (beste Qualität)
  // ═══════════════════════════════════════════════════════════════════════════
  if (taskType === "article_generation" || taskType === "brand_analysis") {
    const model: ModelId = "gemini-3-pro-preview";

    // Articles frequently exceed smaller output windows; ensure a safe minimum to avoid
    // truncated JSON (finish_reason="length"), while still respecting the hard cap.
    const rawMax = Math.min(estimatedOutputTokens * 2, 32000);
    const maxTokens = taskType === "article_generation"
      ? Math.min(Math.max(rawMax, 16000), 32000)
      : rawMax;

    return {
      model,
      maxTokens: Math.floor(maxTokens),
      temperature: taskType === "article_generation" ? 0.7 : 0.3,
      reasoning: `${taskType} → Gemini 3 Pro Preview für maximale SEO-Qualität`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "premium",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 3 PRO IMAGE PREVIEW: Bildgenerierung
  // ═══════════════════════════════════════════════════════════════════════════
  if (taskType === "image_generation") {
    return {
      model: "gemini-3-pro-image-preview",
      maxTokens: 1000,
      temperature: 0.8,
      reasoning: "Bildgenerierung → Gemini 3 Pro Image Preview",
      tier: "image",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 3 FLASH PREVIEW: Outline, Sections, HTML, Code, Recherche
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    taskType === "outline_generation" ||
    taskType === "section_writing" ||
    taskType === "html_design" ||
    taskType === "code_generation" ||
    taskType === "competitor_research"
  ) {
    const model: ModelId = "gemini-3-flash-preview";

    // Section Writing braucht mehr Tokens als Outline
    const maxTokensBase = taskType === "section_writing" ? 4000 :
                          taskType === "outline_generation" ? 4000 : 8000;

    return {
      model,
      maxTokens: Math.floor(Math.min(estimatedOutputTokens * 1.5, maxTokensBase)),
      temperature: taskType === "section_writing" ? 0.7 : 0.5,
      reasoning: `${taskType} → Gemini 3 Flash Preview (Pro-Level, schnell)`,
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
    taskType === "validation" ||
    taskType === "section_review"
  ) {
    const model: ModelId = "gemini-2.5-flash-lite";
    return {
      model,
      maxTokens: Math.floor(Math.min(estimatedOutputTokens * 2, 4000)),
      temperature: 0.3,
      reasoning: `${taskType} → Gemini 2.5 Flash-Lite (30x günstiger!)`,
      estimatedCost: calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
      tier: "budget",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Gemini 3 Flash Preview
  // ═══════════════════════════════════════════════════════════════════════════
  const model: ModelId = "gemini-3-flash-preview";
  return {
    model,
    maxTokens: 4000,
    temperature: 0.5,
    reasoning: "Fallback → Gemini 3 Flash Preview",
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
    const tier = options.forceModel.includes("3-pro") && !options.forceModel.includes("image") ? "premium" :
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
