# Agent Architecture - Token-optimiert

## Problem

Große Datenmengen (Skills, Content, Outputs) können schnell Token-Limits sprengen:
- 18 Skills × ~10KB = 180KB Skill-Dokumentation
- Artikel-Content: 2.000-5.000 Wörter = 10-25KB
- Generierte Outputs: HTML, Social Posts, etc.

**Ziel:** Minimale Token-Nutzung bei maximaler Funktionalität

---

## Architektur-Prinzipien

### 1. Lazy Loading von Skills

```
SCHLECHT: Alle 18 Skills bei jedem API-Call laden
GUT: Nur den benötigten Skill laden, wenn er aufgerufen wird
```

```typescript
// skills/index.ts
export const SKILL_REGISTRY = {
  'social-post-creator': {
    path: '.claude/skills/social-post-creator',
    summary: 'Erstellt Social Media Posts für alle Plattformen',
    entryPoint: 'SKILL.md',
    // Nur laden wenn gebraucht:
    supportingDocs: [
      'PLATFORM_SPECS.md',
      'TONE_GUIDELINES.md'
    ]
  },
  // ... andere Skills
};

// Skill nur bei Bedarf laden
async function loadSkill(skillName: string) {
  const skill = SKILL_REGISTRY[skillName];
  const mainDoc = await readFile(`${skill.path}/${skill.entryPoint}`);
  return mainDoc;
}

// Supporting Docs erst bei spezifischen Fragen
async function loadSupportingDoc(skillName: string, docName: string) {
  const skill = SKILL_REGISTRY[skillName];
  return await readFile(`${skill.path}/${docName}`);
}
```

### 2. Daten in Convex speichern, nicht im Context

```
SCHLECHT:
User → Agent: "Erstelle Social Posts"
Agent → API: { article: "5000 Wörter...", output: "alle Posts..." }

GUT:
User → Agent: "Erstelle Social Posts für Artikel abc123"
Agent → Convex: speichert Output
Agent → User: "Fertig. 6 Posts erstellt. ID: xyz789"
```

```typescript
// Workflow mit Convex-Referenzen
async function createSocialPosts(articleId: string) {
  // 1. Artikel-Metadaten abrufen (klein)
  const article = await ctx.db.get(articleId);

  // 2. Nur bei Bedarf den vollen Content laden
  const content = await ctx.db.get(article.contentId);

  // 3. Posts generieren (intern)
  const posts = await generatePosts(content);

  // 4. In Convex speichern, nicht zurückgeben
  const postIds = await Promise.all(
    posts.map(post => ctx.db.insert('contentAssets', post))
  );

  // 5. Nur Referenzen zurückgeben
  return {
    success: true,
    articleId,
    postsCreated: postIds.length,
    postIds
  };
}
```

### 3. Zusammenfassungen für Agent-Kommunikation

```typescript
// Statt vollständigen Artikel
const articleSummary = {
  id: 'abc123',
  title: 'Content Marketing Guide',
  wordCount: 3500,
  keywords: ['content marketing', 'strategie'],
  sections: ['Einführung', 'Strategie', 'Tools', 'Fazit'],
  // Nicht: content: "3500 Wörter..."
};

// Agent arbeitet mit Summary
// Lädt vollen Content nur wenn nötig via Tool
```

### 4. Multi-Agent mit Router

```
                    ┌─────────────────┐
                    │  ROUTER AGENT   │
                    │ (sieht nur IDs  │
                    │  und Summaries) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌─────▼─────┐        ┌────▼────┐
   │ Content │         │  Social   │        │   SEO   │
   │  Agent  │         │   Agent   │        │  Agent  │
   │(lädt nur│         │(lädt nur  │        │(lädt nur│
   │ content │         │ social    │        │ linking │
   │ skills) │         │ skills)   │        │ skills) │
   └─────────┘         └───────────┘        └─────────┘
```

```typescript
// Router Agent
const routerAgent = {
  systemPrompt: `Du bist ein Router.
    Du siehst nur Zusammenfassungen und IDs.
    Delegiere an spezialisierte Agenten.`,

  tools: [
    { name: 'delegate_to_content_agent', ... },
    { name: 'delegate_to_social_agent', ... },
    { name: 'delegate_to_seo_agent', ... }
  ]
};

// Spezialisierter Agent
const socialAgent = {
  systemPrompt: `Du erstellst Social Media Content.
    Du hast Zugriff auf: social-post-creator Skill`,

  tools: [
    { name: 'read_article_section', ... },
    { name: 'load_platform_specs', ... },
    { name: 'save_post_to_db', ... }
  ]
};
```

---

## Konkrete Implementierung

### Skill-Loader mit Caching

```typescript
// lib/skill-loader.ts

interface SkillCache {
  [key: string]: {
    content: string;
    loadedAt: number;
    ttl: number;
  };
}

const skillCache: SkillCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

export async function getSkillDoc(
  skillName: string,
  docName: string = 'SKILL.md'
): Promise<string> {
  const cacheKey = `${skillName}/${docName}`;

  // Check cache
  if (skillCache[cacheKey]) {
    const cached = skillCache[cacheKey];
    if (Date.now() - cached.loadedAt < cached.ttl) {
      return cached.content;
    }
  }

  // Load from file
  const path = `.claude/skills/${skillName}/${docName}`;
  const content = await fs.readFile(path, 'utf-8');

  // Cache it
  skillCache[cacheKey] = {
    content,
    loadedAt: Date.now(),
    ttl: CACHE_TTL
  };

  return content;
}

// Skill-Summary für Router (immer klein)
export function getSkillSummary(skillName: string): string {
  return SKILL_REGISTRY[skillName]?.summary || '';
}
```

### Tool-Output Limiter

```typescript
// lib/tool-output.ts

const MAX_OUTPUT_SIZE = 4000; // Zeichen

export function limitToolOutput(output: any): any {
  const stringified = JSON.stringify(output);

  if (stringified.length <= MAX_OUTPUT_SIZE) {
    return output;
  }

  // Bei großem Output: Zusammenfassung + Referenz
  return {
    truncated: true,
    summary: createSummary(output),
    fullDataId: await saveToConvex(output),
    message: `Output zu groß (${stringified.length} chars). Gespeichert unter ID: ${fullDataId}`
  };
}

function createSummary(data: any): string {
  if (Array.isArray(data)) {
    return `Array mit ${data.length} Elementen. Erste 3: ${JSON.stringify(data.slice(0, 3))}...`;
  }
  if (typeof data === 'object') {
    return `Object mit Keys: ${Object.keys(data).join(', ')}`;
  }
  return String(data).slice(0, 500) + '...';
}
```

### Content Chunking

```typescript
// lib/content-chunker.ts

interface ContentChunk {
  index: number;
  total: number;
  content: string;
  section?: string;
}

export function chunkArticle(
  content: string,
  maxChunkSize: number = 2000
): ContentChunk[] {
  // Nach Sections splitten (H2)
  const sections = content.split(/(?=## )/);

  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let currentSection = '';

  for (const section of sections) {
    // Section-Header extrahieren
    const headerMatch = section.match(/^## (.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1];
    }

    if (currentChunk.length + section.length > maxChunkSize) {
      // Neuen Chunk starten
      if (currentChunk) {
        chunks.push({
          index: chunks.length,
          total: 0, // wird später gesetzt
          content: currentChunk,
          section: currentSection
        });
      }
      currentChunk = section;
    } else {
      currentChunk += section;
    }
  }

  // Letzten Chunk
  if (currentChunk) {
    chunks.push({
      index: chunks.length,
      total: 0,
      content: currentChunk,
      section: currentSection
    });
  }

  // Total setzen
  return chunks.map(c => ({ ...c, total: chunks.length }));
}

// Verwendung
const chunks = chunkArticle(articleContent);
// Agent verarbeitet Chunk für Chunk
for (const chunk of chunks) {
  await processChunk(chunk);
}
```

### Selektives File-Reading Tool

```typescript
// tools/read-file.ts

export const readFileTool = {
  name: 'read_file_section',
  description: 'Liest einen Abschnitt einer Datei',
  parameters: {
    path: { type: 'string', description: 'Dateipfad' },
    startLine: { type: 'number', description: 'Startzeile (optional)' },
    endLine: { type: 'number', description: 'Endzeile (optional)' },
    section: { type: 'string', description: 'Section-Name z.B. "## Output Format"' }
  },

  async execute({ path, startLine, endLine, section }) {
    const content = await fs.readFile(path, 'utf-8');
    const lines = content.split('\n');

    // Nach Section suchen
    if (section) {
      const sectionStart = lines.findIndex(l => l.includes(section));
      if (sectionStart === -1) {
        return { error: `Section "${section}" nicht gefunden` };
      }

      // Bis zur nächsten gleichwertigen Section lesen
      const sectionEnd = lines.findIndex(
        (l, i) => i > sectionStart && l.match(/^#{1,2} /)
      );

      return {
        content: lines.slice(sectionStart, sectionEnd || undefined).join('\n'),
        lines: { start: sectionStart, end: sectionEnd || lines.length }
      };
    }

    // Nach Zeilen
    if (startLine !== undefined) {
      return {
        content: lines.slice(startLine, endLine).join('\n'),
        lines: { start: startLine, end: endLine || lines.length }
      };
    }

    // Ganzen Inhalt (mit Warnung bei großen Dateien)
    if (lines.length > 100) {
      return {
        warning: `Datei hat ${lines.length} Zeilen. Erwäge selektives Lesen.`,
        preview: lines.slice(0, 50).join('\n'),
        totalLines: lines.length
      };
    }

    return { content };
  }
};
```

---

## Convex Schema für Outputs

```typescript
// convex/schema.ts

// Artikel-Content separat speichern
export const articleContent = defineTable({
  articleId: v.id('articles'),
  content: v.string(), // Markdown
  chunks: v.optional(v.array(v.object({
    index: v.number(),
    content: v.string(),
    section: v.optional(v.string())
  }))),
  wordCount: v.number()
});

// Generated Assets mit Referenzen
export const contentAssets = defineTable({
  articleId: v.id('articles'),
  assetType: v.union(
    v.literal('social_post'),
    v.literal('press_release'),
    v.literal('newsletter'),
    v.literal('ad_copy')
  ),
  platform: v.optional(v.string()),
  content: v.string(),
  metadata: v.optional(v.any()),
  // Für Tracking
  generatedAt: v.number(),
  generatedBy: v.string(), // skill name
});

// Agent Session State (statt im Context)
export const agentSessions = defineTable({
  sessionId: v.string(),
  currentArticleId: v.optional(v.id('articles')),
  currentSkill: v.optional(v.string()),
  state: v.any(),
  lastUpdated: v.number()
});
```

---

## Workflow-Beispiel: Artikel → Social Posts

```typescript
// workflows/article-to-social.ts

async function articleToSocialWorkflow(articleId: string) {
  // 1. Nur Metadaten laden (klein)
  const article = await ctx.db.get(articleId);

  // 2. Skill-Summary für Routing
  const skillSummary = getSkillSummary('social-post-creator');

  // 3. Router entscheidet
  // Agent sieht: { articleId, title, keywords } + skillSummary
  // Nicht: 5000 Wörter Content

  // 4. Bei Bedarf: Chunks laden
  const chunks = await ctx.db.query('articleContent')
    .withIndex('by_article', q => q.eq('articleId', articleId))
    .first();

  // 5. Chunk für Chunk verarbeiten
  for (const chunk of chunks.chunks) {
    const posts = await generatePostsFromChunk(chunk);
    await ctx.db.insert('contentAssets', posts);
  }

  // 6. Nur IDs zurückgeben
  return {
    success: true,
    postsCreated: chunks.chunks.length * 6, // ca. 6 Plattformen
    viewUrl: `/articles/${articleId}/social-posts`
  };
}
```

---

## Checkliste für Token-Optimierung

### Bei jedem Agent-Call prüfen:
- [ ] Werden nur benötigte Skills geladen?
- [ ] Wird Content als Referenz (ID) statt Volltext übergeben?
- [ ] Sind Tool-Outputs limitiert?
- [ ] Werden große Daten in Convex gespeichert?

### Bei Skill-Design:
- [ ] SKILL.md ist die Haupt-Referenz (<5KB)
- [ ] Supporting Docs werden nur bei Bedarf geladen
- [ ] Output-Format nutzt IDs statt Volltext

### Bei Workflow-Design:
- [ ] Router sieht nur Summaries
- [ ] Spezialisierte Agents laden nur ihre Skills
- [ ] Ergebnisse werden in DB gespeichert, nicht zurückgegeben
