"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Du bist ein Content-Editor-Assistent für die NetCo Body-Cam Website.

BRAND GUIDELINES:
- Primärfarbe: #003366 (Dunkelblau)
- Akzentfarbe: #ff6600 (Orange)
- Schreibstil: Professionell, direkt, handlungsorientiert
- Sprache: Deutsch (außer wenn die Seite in anderer Sprache)
- Keine Emojis, keine Umgangssprache
- IMMER echte Umlaute: ä ö ü ß

DEINE AUFGABE:
Du hilfst dabei, den Seiteninhalt der bodycam-Website zu bearbeiten.
Der aktuelle Inhalt der Seite wird dir als JSON-Objekt übergeben.
Wenn du Textänderungen vorschlagen willst, antworte mit einem JSON-Block am Ende deiner Antwort.

FORMAT FÜR ÄNDERUNGSVORSCHLÄGE:
Schreibe am Ende deiner Nachricht einen JSON-Block mit dieser Struktur:
\`\`\`json
{
  "updates": {
    "feldname1": "neuer Wert",
    "feldname2": "neuer Wert"
  }
}
\`\`\`

Wenn du keine Änderungen vorschlägst, lass den JSON-Block weg.
Ändere nur die Felder die der Nutzer explizit verlangt.
Behalte den HTML-Code bei wenn ein Feld HTML enthält.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  text: string;
  suggestedUpdates: Record<string, string> | null;
}

export const chat = action({
  args: {
    pageKey: v.string(),
    lang: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    currentContent: v.string(), // JSON-String des aktuellen Seiteninhalts
  },
  handler: async (_ctx, { pageKey, lang, messages, currentContent }): Promise<ChatResponse> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt (Convex Environment Variables).");
    }

    const client = new Anthropic({ apiKey });

    // Aktuellen Content als Kontext vorbereiten
    let contentPreview: string;
    try {
      const parsed = JSON.parse(currentContent);
      const entries = Object.entries(parsed).slice(0, 30); // Max 30 Felder zeigen
      contentPreview = entries
        .map(([k, v]) => `${k}: ${String(v).slice(0, 150)}`)
        .join("\n");
    } catch {
      contentPreview = currentContent.slice(0, 2000);
    }

    const systemWithContext = `${SYSTEM_PROMPT}

AKTUELLE SEITE: ${pageKey} (Sprache: ${lang})

AKTUELLER SEITENINHALT (Auszug):
${contentPreview}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemWithContext,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    // JSON-Block mit Updates extrahieren
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let suggestedUpdates: Record<string, string> | null = null;

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.updates && typeof parsed.updates === "object") {
          suggestedUpdates = parsed.updates;
        }
      } catch {
        // JSON-Parse-Fehler ignorieren
      }
    }

    // Text ohne den JSON-Block zurückgeben
    const cleanText = text.replace(/```json[\s\S]*?```/g, "").trim();

    return {
      text: cleanText || text,
      suggestedUpdates,
    };
  },
});
