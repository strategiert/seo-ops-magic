// supabase/functions/generate-article/helpers.ts

export function buildBrandContext(brandProfile: any): string {
  if (!brandProfile || brandProfile.crawl_status !== "completed") return "";

  const sections: string[] = [];

  // Identity & Voice
  if (brandProfile.brand_name) sections.push(`**Marke:** ${brandProfile.brand_name}`);
  if (brandProfile.tagline) sections.push(`**Claim:** ${brandProfile.tagline}`);
  
  const voice = brandProfile.brand_voice;
  if (voice) {
    const tone = voice.tone?.join(", ");
    const traits = voice.personality_traits?.join(", ");
    if (tone || traits) sections.push(`**Brand Voice:**\n- Ton: ${tone}\n- Persönlichkeit: ${traits}`);
  }

  // Products & Services (Limit 3)
  const products = brandProfile.products?.slice(0, 3) || [];
  if (products.length > 0) {
    sections.push(`**Produkte:**\n${products.map((p: any) => `- ${p.name}: ${p.description}`).join("\n")}`);
  }

  // Keywords
  if (brandProfile.brand_keywords?.primary?.length) {
    sections.push(`**Brand Keywords:** ${brandProfile.brand_keywords.primary.join(", ")}`);
  }

  // Persona
  const persona = brandProfile.personas?.[0];
  if (persona) {
    sections.push(`**Zielgruppe:** ${persona.name} - ${persona.demographics || "Allgemein"}`);
  }

  return sections.length ? `\n--- BRAND KONTEXT ---\n${sections.join("\n\n")}\n--- ENDE BRAND KONTEXT ---\n` : "";
}

export function transformGuidelines(rawGuidelines: any) {
  // Fallback für leere Guidelines
  if (!rawGuidelines) return { terms: "", questions: "", targetWords: 1500 };

  let terms: string[] = [];
  let questions: string[] = [];
  let targetWords = rawGuidelines.metrics?.word_count?.target || 1500;

  // Support für alte und neue NeuronWriter Struktur
  if (rawGuidelines.terms && !Array.isArray(rawGuidelines.terms)) {
    // Alte Objekt-Struktur
    const basic = rawGuidelines.terms?.content_basic?.map((t: any) => t.t) || [];
    const extended = rawGuidelines.terms?.content_extended?.map((t: any) => t.t) || [];
    terms = [...basic, ...extended];
    
    questions = [
      ...(rawGuidelines.ideas?.suggest_questions?.map((q: any) => q.q) || []),
      ...(rawGuidelines.ideas?.people_also_ask?.map((q: any) => q.q) || [])
    ];
  } else if (Array.isArray(rawGuidelines.terms)) {
    // Neue Array-Struktur
    terms = rawGuidelines.terms.map((t: any) => t.term);
    questions = rawGuidelines.questions || [];
  }

  return {
    terms: terms.slice(0, 30).join(", "),
    questions: questions.slice(0, 10).join("\n- "),
    targetWords
  };
}
