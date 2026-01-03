import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { DesignWrapperOptions, TranslationRequest, FAQ } from '../types';

export class LLMService {
  private provider: 'anthropic' | 'openai';
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private model: string;

  constructor(provider: 'anthropic' | 'openai', apiKey: string, model?: string) {
    this.provider = provider;

    if (provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey });
      this.model = model || 'claude-opus-4-5-20251101';
    } else {
      this.openai = new OpenAI({ apiKey });
      this.model = model || 'gpt-4-turbo-preview';
    }
  }

  /**
   * Convert markdown content to beautiful HTML with Tailwind CSS
   */
  async wrapInTailwindDesign(
    title: string,
    markdown: string,
    faqs: FAQ[],
    options: DesignWrapperOptions = {}
  ): Promise<string> {
    const brand = options.brand || {
      primaryColor: '#003366',
      secondaryColor: '#ff6600',
      accentColor: '#ff8533',
      headingFont: 'Antonio',
      bodyFont: 'PT Sans',
    };

    const prompt = `Du bist ein erfahrener Web-Designer mit exzellentem Geschmack für moderne, elegante Landing Pages.

**AUFGABE:** Erstelle wunderschönen HTML-Content mit **Tailwind CSS** für eine WordPress Custom HTML Sektion.

**WICHTIG - FORMAT:**
- NUR Body-Content (keine <!DOCTYPE>, <html>, <head>, <body> Tags)
- Verwende Tailwind CSS Klassen (keine inline styles, kein <style> Tag)
- Kein externes JavaScript
- Direkter HTML-Content mit Tailwind-Klassen
- Responsive Design mit Tailwind-Breakpoints (sm:, md:, lg:, xl:)

**BRAND GUIDELINES - NetCo Body-Cam:**
- Primary Color: ${brand.primaryColor} (nutze bg-[${brand.primaryColor}], text-[${brand.primaryColor}])
- Secondary Color: ${brand.secondaryColor}
- Accent Color: ${brand.accentColor}
- Headings: font-['${brand.headingFont}'] oder font-bold
- Body: font-['${brand.bodyFont}'] oder font-sans

**DESIGN ANFORDERUNGEN:**
1. Modern und professionell mit Tailwind CSS
2. Vollständig responsive (mobile-first)
3. Schöne Gradient-Hintergründe für Hero (bg-gradient-to-r from-[...] to-[...])
4. Klare Typografie-Hierarchie (text-4xl, text-2xl, text-xl, text-lg)
5. Ausreichend Weißraum (p-8, py-12, my-8, space-y-6)
6. Icon-Listen mit Unicode-Icons oder Tailwind Icons
7. Accordion für FAQs mit Tailwind-Styling
8. Call-to-Action Buttons mit Hover-Effekten (hover:bg-..., transition-all)
9. Schatten und abgerundete Ecken (shadow-lg, rounded-xl)
10. Grid/Flexbox Layouts (grid grid-cols-1 md:grid-cols-2, flex flex-col)

**STRUKTUR:**
\`\`\`html
<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

  <!-- Hero Section ${options.includeHero !== false ? '' : '(SKIP THIS)'} -->
  <div class="bg-gradient-to-r from-[${brand.primaryColor}] to-blue-900 text-white rounded-2xl shadow-2xl p-12 md:p-20 text-center mb-16">
    <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">${title}</h1>
    <p class="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">Einleitungstext</p>
  </div>

  <!-- Content Sections -->
  <div class="space-y-16">
    <!-- Für jede H2 im Markdown -->
    <section class="bg-white rounded-xl shadow-lg p-8 md:p-12">
      <h2 class="text-3xl md:text-4xl font-bold text-[${brand.primaryColor}] mb-6">Überschrift</h2>
      <div class="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
        <p>Inhalt...</p>
      </div>
    </section>

    <!-- Für H3 Subsections -->
    <div class="bg-gray-50 rounded-xl p-8 md:p-10">
      <h3 class="text-2xl md:text-3xl font-bold text-[${brand.primaryColor}] mb-4">Unterüberschrift</h3>
      <p class="text-gray-700 leading-relaxed">Inhalt...</p>
    </div>
  </div>

  <!-- FAQ Section -->
  ${faqs.length > 0 ? `
  <div class="mt-16 bg-white rounded-xl shadow-lg p-8 md:p-12">
    <h2 class="text-3xl md:text-4xl font-bold text-[${brand.primaryColor}] mb-8 text-center">Häufig gestellte Fragen</h2>
    <div class="space-y-4 max-w-4xl mx-auto">
      ${faqs.map(faq => `
      <details class="group bg-gray-50 rounded-lg overflow-hidden">
        <summary class="cursor-pointer p-6 font-semibold text-lg text-gray-800 hover:bg-gray-100 transition-colors flex justify-between items-center">
          ${faq.question}
          <span class="transform group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div class="px-6 pb-6 pt-2 text-gray-700 leading-relaxed">
          ${faq.answer}
        </div>
      </details>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- CTA Section ${options.includeCTA !== false ? '' : '(SKIP THIS)'} -->
  <div class="mt-16 bg-gradient-to-r from-[${brand.secondaryColor}] to-[${brand.accentColor}] text-white rounded-2xl shadow-2xl p-12 md:p-16 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-6">Jetzt starten</h2>
    <p class="text-xl mb-8 text-orange-100">Kontaktieren Sie uns für ein unverbindliches Angebot</p>
    <a href="${options.ctaLink || '#kontakt'}" class="inline-block bg-white text-[${brand.secondaryColor}] font-bold text-lg px-10 py-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
      ${options.ctaText || 'Jetzt anfragen'}
    </a>
  </div>

</div>
\`\`\`

**ARTIKEL INHALT (Markdown):**
${markdown.substring(0, 12000)}

**OUTPUT FORMAT:**
Gib NUR den HTML-Content mit Tailwind CSS Klassen zurück.
- Keine Erklärungen
- Keine Markdown-Codeblöcke (kein \`\`\`html)
- Beginnt direkt mit <div class="max-w-6xl...">
- Verwende moderne Tailwind-Patterns

Erstelle visuell beeindruckenden Content!`;

    console.log('Calling LLM for Tailwind design wrapper...');

    if (this.provider === 'anthropic') {
      const response = await this.anthropic!.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const html = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`✓ Generated Tailwind HTML: ${html.length} characters`);
      return html;
    } else {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
      });

      const html = response.choices[0]?.message?.content || '';
      console.log(`✓ Generated Tailwind HTML: ${html.length} characters`);
      return html;
    }
  }

  /**
   * Translate content to another language
   */
  async translateContent(request: TranslationRequest): Promise<string> {
    const prompt = `Übersetze den folgenden ${request.contentType} von ${request.fromLanguage} nach ${request.toLanguage}.

**WICHTIG:**
- Behalte die Markdown-Formatierung bei (wenn vorhanden)
- Übersetze natürlich und idiomatisch, nicht wörtlich
- Behalte Fachbegriffe und SEO-Keywords bei (wenn sinnvoll)
- Achte auf kulturelle Anpassungen

**INHALT:**
${request.content}

**OUTPUT:**
Gib NUR die Übersetzung zurück, ohne Erklärungen oder Kommentare.`;

    console.log(`Translating ${request.contentType} from ${request.fromLanguage} to ${request.toLanguage}...`);

    if (this.provider === 'anthropic') {
      const response = await this.anthropic!.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const translation = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`✓ Translation completed: ${translation.length} characters`);
      return translation;
    } else {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
      });

      const translation = response.choices[0]?.message?.content || '';
      console.log(`✓ Translation completed: ${translation.length} characters`);
      return translation;
    }
  }
}
