import type { DriveStep } from "driver.js";

/**
 * Tour element IDs - these need to be added to the corresponding components
 */
export const TOUR_IDS = {
  // Sidebar navigation
  SIDEBAR_BRIEFS: "tour-sidebar-briefs",
  SIDEBAR_ARTICLES: "tour-sidebar-articles",
  SIDEBAR_TEMPLATES: "tour-sidebar-templates",
  SIDEBAR_PROJECTS: "tour-sidebar-projects",
  SIDEBAR_SETTINGS: "tour-sidebar-settings",

  // Dashboard elements
  DASHBOARD_QUICK_ACTIONS: "tour-dashboard-quick-actions",
  DASHBOARD_STATS: "tour-dashboard-stats",

  // Action buttons
  ACTION_NEW_BRIEF: "tour-action-new-brief",
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

/**
 * Main tour steps - introduces the core features of the app
 */
export const TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Willkommen zur SEO Content Ops Suite!",
      description:
        "Diese kurze Tour zeigt dir die wichtigsten Funktionen. Du kannst sie jederzeit in den Einstellungen neu starten.",
      side: "over" as const,
      align: "center" as const,
    },
  },
  {
    element: `#${TOUR_IDS.SIDEBAR_BRIEFS}`,
    popover: {
      title: "Content Briefs",
      description:
        "Hier erstellst du SEO-optimierte Briefings. Definiere Keywords, Suchintention und Zielgruppe für deine Artikel.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: `#${TOUR_IDS.SIDEBAR_ARTICLES}`,
    popover: {
      title: "Artikel",
      description:
        "Deine generierten Artikel findest du hier. Bearbeite, prüfe und veröffentliche sie zu WordPress.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: `#${TOUR_IDS.SIDEBAR_TEMPLATES}`,
    popover: {
      title: "Elementor Templates",
      description:
        "Exportiere Artikel als Elementor-kompatible JSON-Templates für den direkten WordPress-Import.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: `#${TOUR_IDS.SIDEBAR_PROJECTS}`,
    popover: {
      title: "Projekte",
      description:
        "Verwalte mehrere Websites oder Brands. Jedes Projekt hat eigene Einstellungen und Integrationen.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: `#${TOUR_IDS.SIDEBAR_SETTINGS}`,
    popover: {
      title: "Einstellungen",
      description:
        "Verbinde NeuronWriter, WordPress und konfiguriere Projekt-Defaults.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    popover: {
      title: "Bereit zum Start!",
      description:
        'Erstelle dein erstes Projekt und dann einen Content Brief, um loszulegen. Viel Erfolg!',
      side: "over" as const,
      align: "center" as const,
    },
  },
];

/**
 * Dashboard-specific tour steps (shown after project is created)
 */
export const DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    element: `#${TOUR_IDS.DASHBOARD_QUICK_ACTIONS}`,
    popover: {
      title: "Schnellzugriff",
      description:
        "Starte hier die häufigsten Aktionen: Brief erstellen, Artikel generieren oder Template exportieren.",
      side: "bottom" as const,
      align: "center" as const,
    },
  },
  {
    element: `#${TOUR_IDS.DASHBOARD_STATS}`,
    popover: {
      title: "Statistiken",
      description:
        "Behalte den Überblick über deine Content-Pipeline mit diesen Kennzahlen.",
      side: "top" as const,
      align: "center" as const,
    },
  },
];
