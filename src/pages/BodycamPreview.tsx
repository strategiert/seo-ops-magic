import { useParams } from "react-router-dom";

/**
 * Öffentliche Vorschau einer Bodycam-Seite.
 * Zeigt die LIVE Astro-Seite mit draft-Inhalt aus Convex injiziert.
 * Route: /bodycam/preview/:pageKey/:lang
 */
export default function BodycamPreview() {
  const { pageKey, lang = "de" } = useParams<{ pageKey: string; lang: string }>();

  // Convex HTTP site URL (cloud → site)
  const convexUrl = (import.meta.env.VITE_CONVEX_URL as string) ?? "";
  const httpBase = convexUrl.replace(".convex.cloud", ".convex.site");

  if (!pageKey || !httpBase) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Kein pageKey angegeben.
      </div>
    );
  }

  // Cache-Busting via ?t= damit "Reload"-Klick im Editor funktioniert
  const previewSrc = `${httpBase}/bodycam-preview?pageKey=${encodeURIComponent(pageKey)}&lang=${encodeURIComponent(lang)}`;

  return (
    <iframe
      src={previewSrc}
      className="w-full border-0"
      style={{ height: "100vh", display: "block" }}
      title={`Vorschau: ${pageKey} (${lang})`}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
