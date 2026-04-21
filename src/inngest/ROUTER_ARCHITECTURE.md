# Router Agent Architecture

## Übersicht

Der **Router Agent** ist das zentrale Gehirn des Multi-Agent-Systems. Er analysiert User-Anfragen, plant Workflows und orchestriert spezialisierte Skill-Agents.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                         USER REQUEST                         │
│  "Erstelle einen Artikel und veröffentliche ihn auf WP"     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ROUTER AGENT                            │
│  ───────────────────────────────────────────────────────    │
│  1. Lädt nur SKILL SUMMARIES (nicht volle Docs)             │
│  2. Analysiert Intent mit LLM                                │
│  3. Erstellt Ausführungsplan                                 │
│  4. Sendet Events an Skill-Agents                            │
│                                                              │
│  Sieht: Metadaten, IDs, Summaries                           │
│  Sieht NICHT: Volltext, generierte Inhalte                  │
│                                                              │
│  Credits: 2                                                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ SEO Writer  │    │HTML Designer│    │ WP Publisher│
    │   Agent     │    │   Agent     │    │   Agent     │
    │             │    │             │    │             │
    │ DENKT ✓    │    │ DENKT ✗    │    │ DENKT ✗    │
    │ Credits: 10 │    │ Credits: 3  │    │ Credits: 1  │
    └─────────────┘    └─────────────┘    └─────────────┘
```

## Skill-Klassifizierung

### Denkende Skills (mit LLM-Reasoning)
| Skill | Beschreibung | Credits |
|-------|--------------|---------|
| seo-content-writer | SEO-optimierte Artikel | 10 |
| social-post-creator | Social Media Posts | 5 |
| ad-copy-writer | Werbetexte | 4 |
| press-release-writer | Pressemitteilungen | 6 |
| newsletter-composer | Newsletter | 5 |
| content-translator | Übersetzungen | 7 |
| image-generator | Bild-Prompts | 8 |

### Deterministische Skills (kein LLM)
| Skill | Beschreibung | Credits |
|-------|--------------|---------|
| wordpress-publisher | WP REST API | 1 |
| internal-linker | Link-Analyse | 5 |
| html-designer | MD → HTML | 3 |

## Verwendung

### Via Convex Action
```typescript
// Natürliche Sprache
await convex.action(api.agents.routerTriggers.triggerRouter, {
  projectId: "...",
  userMessage: "Erstelle Social Posts für den letzten Artikel",
  autoExecute: true,
});

// Full Pipeline
await convex.action(api.agents.routerTriggers.triggerFullPipeline, {
  briefId: "...",
  options: {
    generateSocialPosts: true,
    publishToWordPress: true,
  },
});
```

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/inngest/agents/routerAgent.ts` | Router Inngest Function |
| `src/inngest/lib/skillLoader.ts` | Lädt Skills dynamisch |
| `src/inngest/client.ts` | Event-Types |
| `convex/agents/routerTriggers.ts` | Convex Actions |

## Token-Optimierung

1. **Lazy Loading**: Skills werden nur bei Bedarf geladen
2. **Summaries**: Router sieht nur ~100 Wörter pro Skill
3. **Metadaten**: Artikel-Titel statt Volltext
4. **ID-Referenzen**: Ergebnisse in DB, nur IDs zurück
