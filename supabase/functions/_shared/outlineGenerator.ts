// supabase/functions/_shared/outlineGenerator.ts
// Outline Generator - Erstellt SEO-optimierte Artikel-Struktur
// Plan Phase 3.2: Outline Generator (LLM)

import { routeToModel, getGeminiEndpoint } from "./model-router.ts";
import type { ResearchPack } from "./researchPack.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface Section {
  index: number;
  headingType: 'h1' | 'h2' | 'h3';
  headingText: string;
  purpose: string;              // Was soll diese Section erreichen?
  targetWordCount: number;
  plannedKeywords: string[];    // Keywords die hier verwendet werden sollen
  imageNeeded: boolean;
  imageContext?: string;        // Kontext für Bildgenerierung
  parentIndex?: number;         // Für H3s: Index der übergeordneten H2
}

export interface Outline {
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  sections: Section[];
  totalWordCount: number;
  faqQuestions: string[];       // Vorgeschlagene FAQ-Fragen
}

export interface OutlineGeneratorOptions {
  brandVoice?: string;
  targetAudience?: string;
  additionalInstructions?: string;
}

// ============================================================================
// OUTLINE GENERATOR
// ============================================================================

/**
 * Generiert eine SEO-optimierte Outline aus dem ResearchPack
 */
export async function generateOutline(
  researchPack: ResearchPack,
  options: OutlineGeneratorOptions = {}
): Promise<Outline> {
  const { brandVoice, targetAudience, additionalInstructions } = options;

  // Keyword-Verteilung vorbereiten
  const titleKeywords = researchPack.requirements.title.map(k => k.term);
  const h1Keywords = researchPack.requirements.h1.map(k => k.term);
  const h2Keywords = researchPack.requirements.h2.map(k => k.term);
  const bodyKeywords = researchPack.requirements.body.slice(0, 30).map(k => `${k.term} (${k.count}x)`);

  // SERP-Analyse für Struktur-Inspiration
  const competitorStructures = researchPack.serp.topResults
    .slice(0, 5)
    .map(r => `- ${r.title}`)
    .join("\n");

  const systemPrompt = `Du bist ein SEO Content Strategist. Du erstellst NUR die Struktur/Outline für Artikel - KEINEN Content.
Deine Antwort muss ein valides JSON-Objekt sein.
- Beginne direkt mit {
- Ende mit }
- Schreibe KEINEN Text vor oder nach dem JSON.`;

  const userPrompt = `Erstelle eine detaillierte Outline für einen SEO-Artikel.

## Keyword & Intent
- Hauptkeyword: "${researchPack.keyword}"
- Suchintention: ${researchPack.intent.primary} (${researchPack.intent.stage})
- Locale: ${researchPack.locale}

## Keyword-Anforderungen (WICHTIG!)
**Im Title/Meta-Title verwenden:**
${titleKeywords.join(", ") || researchPack.keyword}

**Im H1 verwenden:**
${h1Keywords.join(", ") || researchPack.keyword}

**In H2-Überschriften verteilen:**
${h2Keywords.join(", ") || "Relevante Aspekte des Hauptkeywords"}

**Im Body-Text einbauen (mit Häufigkeit):**
${bodyKeywords.join(", ")}

## Empfehlungen aus SEO-Analyse
- Ziel-Wortanzahl: ${researchPack.recommendations.wordCountRange[0]}-${researchPack.recommendations.wordCountRange[1]} Wörter
- H2-Überschriften: ca. ${researchPack.recommendations.headingCount.h2}
- H3-Überschriften: ca. ${researchPack.recommendations.headingCount.h3}
- Bilder: ${researchPack.recommendations.imageCount}
- FAQ-Fragen: ${researchPack.recommendations.faqCount}

## Wettbewerber-Titel (zur Inspiration)
${competitorStructures}

## Fragen die Nutzer stellen
${researchPack.keywords.questions.slice(0, 8).map(q => `- ${q}`).join("\n")}

${brandVoice ? `## Brand Voice\n${brandVoice}` : ""}
${targetAudience ? `## Zielgruppe\n${targetAudience}` : ""}
${additionalInstructions ? `## Zusätzliche Anweisungen\n${additionalInstructions}` : ""}

## Aufgabe
1. Erstelle einen SEO-optimierten Title und Meta-Description
2. Plane die H1 mit dem Hauptkeyword
3. Erstelle eine logische H2/H3-Struktur
4. Verteile die Body-Keywords sinnvoll auf die Sections
5. Markiere welche Sections ein Bild brauchen
6. Wähle passende FAQ-Fragen

## JSON Output Format
{
  "title": "SEO-optimierter Artikel-Titel mit Hauptkeyword",
  "metaTitle": "Meta-Title (max 60 Zeichen) mit Keyword",
  "metaDescription": "Meta-Description (max 155 Zeichen) mit Call-to-Action",
  "h1": "H1-Überschrift mit Hauptkeyword",
  "sections": [
    {
      "index": 0,
      "headingType": "h2",
      "headingText": "Überschrift mit relevantem Keyword",
      "purpose": "Kurze Beschreibung was diese Section erreichen soll",
      "targetWordCount": 200,
      "plannedKeywords": ["keyword1", "keyword2"],
      "imageNeeded": true,
      "imageContext": "Beschreibung für Bildgenerierung"
    }
  ],
  "totalWordCount": 1500,
  "faqQuestions": ["Frage 1?", "Frage 2?"]
}`;

  // Model Routing
  const modelConfig = routeToModel("outline_generation", userPrompt, {});
  console.log(`[OutlineGenerator] Using model: ${modelConfig.model}`);

  // LLM Call
  const response = await fetch(getGeminiEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[OutlineGenerator] API Error:", err);
    throw new Error(`Outline generation failed: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from LLM");
  }

  // JSON extrahieren
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    content = content.substring(firstBrace, lastBrace + 1);
  }

  let outline: Outline;
  try {
    outline = JSON.parse(content);
  } catch (e) {
    console.error("[OutlineGenerator] JSON Parse Error:", content.substring(0, 500));
    throw new Error("Failed to parse outline JSON");
  }

  // Post-Processing: Validierung und Anreicherung
  outline = validateAndEnrichOutline(outline, researchPack);

  console.log(`[OutlineGenerator] Created outline with ${outline.sections.length} sections, ${outline.totalWordCount} target words`);

  return outline;
}

/**
 * Validiert und reichert die Outline an
 */
function validateAndEnrichOutline(outline: Outline, pack: ResearchPack): Outline {
  // Stelle sicher dass alle Pflichtfelder vorhanden sind
  if (!outline.title) outline.title = pack.keyword;
  if (!outline.metaTitle) outline.metaTitle = outline.title.substring(0, 60);
  if (!outline.metaDescription) outline.metaDescription = `Erfahren Sie alles über ${pack.keyword}. ✓ Komplett-Guide ✓ Aktuelle Infos`;
  if (!outline.h1) outline.h1 = outline.title;
  if (!outline.sections) outline.sections = [];
  if (!outline.faqQuestions) outline.faqQuestions = pack.keywords.questions.slice(0, 5);

  // Sections indexieren und validieren
  outline.sections = outline.sections.map((section, idx) => ({
    ...section,
    index: idx,
    headingType: section.headingType || 'h2',
    targetWordCount: section.targetWordCount || 200,
    plannedKeywords: section.plannedKeywords || [],
    imageNeeded: section.imageNeeded ?? (idx % 2 === 0), // Default: jede 2. Section
  }));

  // Gesamtwortanzahl berechnen falls nicht gesetzt
  if (!outline.totalWordCount || outline.totalWordCount < 500) {
    outline.totalWordCount = outline.sections.reduce((sum, s) => sum + (s.targetWordCount || 200), 0);
  }

  return outline;
}

/**
 * Erstellt eine einfache Outline ohne LLM (Fallback)
 */
export function createBasicOutline(researchPack: ResearchPack): Outline {
  const keyword = researchPack.keyword;
  const wordCountTarget = researchPack.recommendations.wordCountRange[1];
  const h2Count = researchPack.recommendations.headingCount.h2 || 5;

  const sections: Section[] = [];

  // Intro Section
  sections.push({
    index: 0,
    headingType: 'h2',
    headingText: `Was ist ${keyword}?`,
    purpose: "Einführung und Definition",
    targetWordCount: Math.round(wordCountTarget * 0.15),
    plannedKeywords: researchPack.requirements.body.slice(0, 3).map(k => k.term),
    imageNeeded: true,
    imageContext: `Hero-Bild für ${keyword}`,
  });

  // Body Sections basierend auf Questions
  const questions = researchPack.keywords.questions.slice(0, h2Count - 2);
  questions.forEach((question, idx) => {
    sections.push({
      index: idx + 1,
      headingType: 'h2',
      headingText: question.replace(/\?$/, ''),
      purpose: `Beantwortet: ${question}`,
      targetWordCount: Math.round(wordCountTarget * 0.15),
      plannedKeywords: researchPack.requirements.body.slice(idx * 3, idx * 3 + 3).map(k => k.term),
      imageNeeded: idx % 2 === 0,
    });
  });

  // Fazit Section
  sections.push({
    index: sections.length,
    headingType: 'h2',
    headingText: `Fazit: ${keyword}`,
    purpose: "Zusammenfassung und Call-to-Action",
    targetWordCount: Math.round(wordCountTarget * 0.1),
    plannedKeywords: researchPack.requirements.title.map(k => k.term),
    imageNeeded: false,
  });

  return {
    title: `${keyword} - Der komplette Guide ${new Date().getFullYear()}`,
    metaTitle: `${keyword} » Alles was Sie wissen müssen`,
    metaDescription: `Erfahren Sie alles über ${keyword}. ✓ Aktueller Guide ✓ Expertenwissen ✓ Praktische Tipps`,
    h1: `${keyword}: Der ultimative Leitfaden`,
    sections,
    totalWordCount: wordCountTarget,
    faqQuestions: researchPack.keywords.questions.slice(0, 5),
  };
}

/**
 * Konvertiert Outline zu Markdown-Vorlage (für Preview)
 */
export function outlineToMarkdownPreview(outline: Outline): string {
  const lines: string[] = [];

  lines.push(`# ${outline.h1}`);
  lines.push('');
  lines.push(`> **Meta-Title:** ${outline.metaTitle}`);
  lines.push(`> **Meta-Description:** ${outline.metaDescription}`);
  lines.push(`> **Ziel-Wortanzahl:** ${outline.totalWordCount}`);
  lines.push('');

  for (const section of outline.sections) {
    const prefix = section.headingType === 'h2' ? '## ' : '### ';
    lines.push(`${prefix}${section.headingText}`);
    lines.push(`*Zweck: ${section.purpose}*`);
    lines.push(`*Keywords: ${section.plannedKeywords.join(', ')}*`);
    lines.push(`*Ziel: ~${section.targetWordCount} Wörter${section.imageNeeded ? ' + Bild' : ''}*`);
    lines.push('');
  }

  if (outline.faqQuestions.length > 0) {
    lines.push('## FAQ');
    for (const q of outline.faqQuestions) {
      lines.push(`- ${q}`);
    }
  }

  return lines.join('\n');
}
