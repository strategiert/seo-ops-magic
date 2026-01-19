/**
 * Zentrale Hilfetexte für InfoTooltips
 *
 * Organisiert nach Bereich/Feature für einfache Wartung.
 */

export const HELP_CONTENT = {
  // Brief-bezogene Hilfetexte
  briefs: {
    primaryKeyword: "Das Hauptkeyword, für das der Artikel optimiert wird. Basis für SEO-Analyse und Content-Struktur.",
    searchIntent: "Die Suchintention beschreibt, was der Nutzer mit seiner Suche erreichen möchte: Information suchen, etwas kaufen, oder zu einer bestimmten Seite navigieren.",
    targetLength: "Die empfohlene Wortanzahl basiert auf der Konkurrenzanalyse. Längere Artikel ranken oft besser für kompetitive Keywords.",
    priorityScore: "Ein Score von 1-100, der die Wichtigkeit des Briefs basierend auf Suchvolumen, Wettbewerb und strategischer Relevanz bewertet.",
    nwGuidelines: "Importierte SEO-Richtlinien aus NeuronWriter mit Keyword-Empfehlungen, Fragen und Themenvorschlägen.",
    tonality: "Der Schreibstil des Artikels: professionell, freundlich, sachlich, etc.",
    targetAudience: "Die Zielgruppe, für die der Artikel geschrieben wird. Beeinflusst Sprache, Tiefe und Beispiele.",
  },

  // Artikel-bezogene Hilfetexte
  articles: {
    status: {
      draft: "Entwurf - Der Artikel wird noch bearbeitet.",
      review: "Review - Der Artikel wartet auf Prüfung.",
      approved: "Freigegeben - Der Artikel ist bereit zur Veröffentlichung.",
      published: "Veröffentlicht - Der Artikel ist live auf der Website.",
    },
    version: "Versionsnummer des Artikels. Wird bei jeder Überarbeitung erhöht.",
    metaTitle: "Der SEO-Titel, der in Suchergebnissen angezeigt wird. Optimal: 50-60 Zeichen.",
    metaDescription: "Die Meta-Beschreibung für Suchergebnisse. Optimal: 150-160 Zeichen.",
    styledHtml: "AI-generiertes HTML mit Tailwind-Styling für ansprechende Darstellung in WordPress.",
  },

  // Template-bezogene Hilfetexte
  templates: {
    designPreset: "Vordefinierte Design-Variante für das Elementor Template: Standard, Modern, Minimal oder Bold.",
    templateJson: "Das Elementor-kompatible JSON-Format für den direkten Import in WordPress.",
  },

  // Projekt-bezogene Hilfetexte
  projects: {
    domain: "Die Hauptdomain der Website. Wird für interne Verlinkungen und WordPress-Integration verwendet.",
    wpUrl: "Die WordPress REST API URL (z.B. https://example.de/wp-json).",
    defaultLanguage: "Die Standardsprache für neue Content Briefs und Artikel.",
    defaultCountry: "Das Zielland für SEO-Optimierung und lokale Anpassungen.",
  },

  // Integration-bezogene Hilfetexte
  integrations: {
    neuronWriter: "NeuronWriter liefert SEO-Guidelines, Keywords und Wettbewerbsanalysen für deine Content Briefs.",
    wordpress: "Die WordPress-Integration ermöglicht direktes Publizieren von Artikeln zu deiner Website.",
    gsc: "Google Search Console zeigt Ranking-Daten und Performance-Metriken für deine Inhalte.",
  },

  // Dashboard-bezogene Hilfetexte
  dashboard: {
    quickActions: "Schnellzugriff auf die häufigsten Aktionen: Brief erstellen, Artikel generieren, Template exportieren.",
    stats: "Übersicht über deine Content-Pipeline: Anzahl der Briefs, Artikel und Templates.",
  },

  // Onboarding-bezogene Hilfetexte
  onboarding: {
    tour: "Die geführte Tour zeigt dir die wichtigsten Funktionen der SEO Content Ops Suite.",
    restart: "Starte die Einführungstour erneut, um alle Features kennenzulernen.",
  },
} as const;

export type HelpContentKey = keyof typeof HELP_CONTENT;
