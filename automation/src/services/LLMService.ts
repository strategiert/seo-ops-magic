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
   * Convert markdown content to beautiful HTML with inline styles
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

**AUFGABE:** Erstelle wunderschönen HTML-Content mit **INLINE STYLES** für WordPress.

**KRITISCH WICHTIG - FORMAT:**
- NUR Body-Content (keine <!DOCTYPE>, <html>, <head>, <body> Tags)
- **ALLE STYLES MÜSSEN INLINE SEIN** (style="..." direkt in den HTML-Elementen)
- **KEIN <style> TAG erlaubt**
- **KEINE CSS-Klassen** (außer für WordPress-Kompatibilität)
- Kein externes JavaScript
- Direkter HTML-Content mit inline style Attributen
- Responsive Design durch Media Queries in inline styles ODER durch kluge Layout-Entscheidungen

**BRAND GUIDELINES:**
- Primary Color: ${brand.primaryColor}
- Secondary Color: ${brand.secondaryColor}
- Accent Color: ${brand.accentColor}
- Headings: font-family: '${brand.headingFont}', sans-serif
- Body: font-family: '${brand.bodyFont}', sans-serif

**DESIGN ANFORDERUNGEN (alles inline):**
1. Modern und professionell mit inline styles
2. Schöne Gradient-Hintergründe für Hero (background: linear-gradient(135deg, ...))
3. Klare Typografie-Hierarchie (font-size: 2.5em für H1, 2em für H2, etc.)
4. Ausreichend Weißraum (padding, margin in px oder rem)
5. Listen mit Unicode-Icons (✓, •, →)
6. Call-to-Action Buttons mit hover-Effekten
7. Schatten und abgerundete Ecken (box-shadow, border-radius)
8. Responsive durch max-width und flexible Layouts

**BEISPIEL-STRUKTUR:**
\`\`\`html
<div style="font-family: '${brand.bodyFont}', sans-serif; color: #333333; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f8f8f8; box-shadow: 0 0 15px rgba(0, 0, 0, 0.05); border-radius: 10px;">

  <!-- Hero Section ${options.includeHero !== false ? '' : '(SKIP THIS)'} -->
  <div style="background: linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.secondaryColor} 100%); color: #ffffff; padding: 40px; border-radius: 8px; margin-bottom: 30px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
    <h1 style="font-family: '${brand.headingFont}', sans-serif; font-weight: bold; font-size: 2.8em; margin-top: 0; margin-bottom: 15px; line-height: 1.2; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);">${title}</h1>
    <p style="font-family: '${brand.bodyFont}', sans-serif; font-size: 1.1em; line-height: 1.6; max-width: 700px; margin: 0 auto;">Lead paragraph...</p>
  </div>

  <!-- Content Sections -->
  <h2 style="font-family: '${brand.headingFont}', sans-serif; font-weight: bold; color: ${brand.primaryColor}; font-size: 2em; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid ${brand.secondaryColor}; padding-bottom: 10px;">Section Title</h2>
  <p style="font-family: '${brand.bodyFont}', sans-serif; color: #333333; margin-bottom: 15px;">Content paragraph...</p>

  <!-- Lists with icons -->
  <ul style="list-style: none; padding: 0; margin-top: 15px;">
    <li style="font-family: '${brand.bodyFont}', sans-serif; color: #333333; margin-bottom: 10px;"><span style="color: ${brand.secondaryColor}; font-weight: bold; margin-right: 8px;">✓</span> List item</li>
  </ul>

  <!-- FAQ Section -->
  ${faqs.length > 0 ? `
  <h2 style="font-family: '${brand.headingFont}', sans-serif; font-weight: bold; color: ${brand.primaryColor}; font-size: 2em; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid ${brand.secondaryColor}; padding-bottom: 10px;">Häufig gestellte Fragen</h2>
  ${faqs.map(faq => `
  <details style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
    <summary style="cursor: pointer; font-family: '${brand.headingFont}', sans-serif; font-weight: bold; font-size: 1.1em; color: ${brand.primaryColor};">${faq.question}</summary>
    <div style="font-family: '${brand.bodyFont}', sans-serif; color: #555555; margin-top: 10px; line-height: 1.6;">${faq.answer}</div>
  </details>
  `).join('')}
  ` : ''}

  <!-- CTA Section ${options.includeCTA !== false ? '' : '(SKIP THIS)'} -->
  <div style="margin-top: 40px; background: linear-gradient(135deg, ${brand.secondaryColor} 0%, ${brand.accentColor} 100%); color: #ffffff; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
    <h2 style="font-family: '${brand.headingFont}', sans-serif; font-size: 2em; margin-top: 0; margin-bottom: 15px;">Jetzt starten</h2>
    <p style="font-family: '${brand.bodyFont}', sans-serif; font-size: 1.1em; margin-bottom: 20px;">CTA description</p>
    <a href="${options.ctaLink || '#kontakt'}" style="display: inline-block; background: #ffffff; color: ${brand.secondaryColor}; font-family: '${brand.headingFont}', sans-serif; font-weight: bold; font-size: 1.1em; padding: 15px 40px; border-radius: 50px; text-decoration: none; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); transition: transform 0.2s;">${options.ctaText || 'Jetzt anfragen'}</a>
  </div>

</div>
\`\`\`

**ARTIKEL INHALT (Markdown):**
${markdown.substring(0, 12000)}

**OUTPUT FORMAT - KRITISCH:**
- Gib NUR den HTML-Content zurück
- ALLE Styles müssen inline sein (style="...")
- KEIN <style> Tag
- KEINE CSS-Klassen (außer semantische wie <strong>, <em>)
- Keine Erklärungen
- Keine Markdown-Codeblöcke (kein \`\`\`html)
- Beginnt direkt mit <div style="...">

**INLINE STYLE BEISPIELE:**
- Padding: style="padding: 20px;"
- Colors: style="color: #333333; background-color: #f8f8f8;"
- Fonts: style="font-family: 'Antonio', sans-serif; font-size: 2em; font-weight: bold;"
- Margins: style="margin-top: 40px; margin-bottom: 20px;"
- Borders: style="border: 2px solid #ff6600; border-radius: 8px;"
- Shadows: style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);"
- Gradients: style="background: linear-gradient(135deg, #003366 0%, #ff6600 100%);"

Erstelle visuell beeindruckenden Content mit ausschließlich inline styles!`;

    console.log('Calling LLM for inline styled HTML wrapper...');

    if (this.provider === 'anthropic') {
      const response = await this.anthropic!.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const html = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`✓ Generated inline styled HTML: ${html.length} characters`);
      return html;
    } else {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
      });

      const html = response.choices[0]?.message?.content || '';
      console.log(`✓ Generated inline styled HTML: ${html.length} characters`);
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
