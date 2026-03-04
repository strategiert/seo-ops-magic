import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestedUpdates?: Record<string, string> | null;
  applied?: boolean;
}

interface AIChatPanelProps {
  pageKey: string;
  lang: string;
  currentContent: Record<string, unknown> | null;
  onApplyUpdates: (updates: Record<string, string>) => void;
}

const QUICK_PROMPTS = [
  "Mach die Hero-Headline kürzer",
  "Formuliere die CTA-Texte überzeugender",
  "Verbessere den SEO-Beschreibungstext",
  "Übersetze alle Texte ins Englische",
];

export function AIChatPanel({
  pageKey,
  lang,
  currentContent,
  onApplyUpdates,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendChat = useAction(api.actions.bodycamAI.chat);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const userMessage = text ?? input.trim();
    if (!userMessage || isLoading) return;

    setInput("");
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const result = await sendChat({
        pageKey,
        lang,
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        currentContent: currentContent
          ? JSON.stringify(currentContent)
          : "{}",
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.text,
          suggestedUpdates: result.suggestedUpdates,
        },
      ]);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isApiKeyMissing =
        rawMsg.includes("ANTHROPIC_API_KEY") ||
        rawMsg.includes("API key") ||
        rawMsg.includes("Unauthorized");
      const errorMessage = isApiKeyMissing
        ? "KI nicht verfügbar: ANTHROPIC_API_KEY fehlt in den Convex Environment Variables. Bitte in der Convex-Konsole unter Settings → Environment Variables eintragen."
        : `Fehler: ${rawMsg}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
          suggestedUpdates: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (msgIndex: number, updates: Record<string, string>) => {
    onApplyUpdates(updates);
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, applied: true } : m))
    );
  };

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-white/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#ff6600]" />
          <span className="text-sm font-semibold">KI-Assistent</span>
          <Badge variant="outline" className="text-xs ml-auto">
            Claude
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center pt-2">
              Sag mir was du ändern möchtest.
            </p>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded border bg-white hover:bg-[#003366]/5 hover:border-[#003366]/30 transition-colors text-muted-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                msg.role === "user"
                  ? "bg-[#003366] text-white"
                  : "bg-[#ff6600] text-white"
              }`}
            >
              {msg.role === "user" ? (
                <User className="h-3 w-3" />
              ) : (
                <Bot className="h-3 w-3" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[#003366] text-white"
                  : "bg-white border shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed text-xs">
                {msg.content}
              </p>

              {/* Änderungsvorschlag anwenden */}
              {msg.role === "assistant" &&
                msg.suggestedUpdates &&
                Object.keys(msg.suggestedUpdates).length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {Object.keys(msg.suggestedUpdates).length}{" "}
                      {Object.keys(msg.suggestedUpdates).length === 1
                        ? "Feld"
                        : "Felder"}{" "}
                      zum Ändern:
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.keys(msg.suggestedUpdates).map((k) => (
                        <Badge
                          key={k}
                          variant="secondary"
                          className="text-xs font-mono"
                        >
                          {k}
                        </Badge>
                      ))}
                    </div>
                    {msg.applied ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Angewendet
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleApply(i, msg.suggestedUpdates!)}
                        className="w-full h-7 text-xs bg-[#003366] hover:bg-[#002244] text-white"
                      >
                        Änderungen anwenden
                      </Button>
                    )}
                  </div>
                )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#ff6600] text-white flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3" />
            </div>
            <div className="bg-white border rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white/50 shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Schreib einen Auftrag… (Enter zum Senden)"
            className="text-xs resize-none min-h-[60px] max-h-[120px]"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="self-end bg-[#003366] hover:bg-[#002244] text-white px-3"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
