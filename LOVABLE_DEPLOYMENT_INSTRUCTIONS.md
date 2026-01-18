# Deployment Instructions für Lovable

## Übersicht

Es wurden neue Supabase Migrations und Edge Functions für das **Brand Intelligence System** erstellt. Diese müssen deployed werden.

---

## 1. Database Migration deployen

### Migration: `20260109000000_brand_intelligence_system.sql`

**Pfad:** `supabase/migrations/20260109000000_brand_intelligence_system.sql`

**Was wird erstellt:**

1. **Neue Tabelle `brand_research_jobs`** - Progress-Tracking für lange Operations
   - `job_type`: 'full_discovery' | 'sitemap_crawl' | 'perplexity_research' | 'competitor_analysis' | 'competitor_crawl'
   - `status`: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
   - `progress`: 0-100
   - `current_step`, `steps_completed`, `steps_total`
   - `result` JSONB, `error_message`

2. **Neue Tabelle `brand_research_results`** - Perplexity Research Cache
   - `research_type`: 'market_analysis' | 'industry_trends' | 'brand_perception' | 'audience_insights' | 'content_gaps' | 'pricing_intelligence' | 'technology_stack'
   - `result_data` JSONB, `citations` JSONB
   - `cache_key`, `expires_at` (7 Tage Cache)

3. **Neue Tabelle `brand_competitor_profiles`** - Detaillierte Competitor-Daten
   - `name`, `domain`, `description`, `industry`
   - `strengths`, `weaknesses`, `market_position` JSONB
   - `crawl_status`, `extracted_*` Felder für gecrawlte Daten
   - `similarity_score`, `threat_level`

4. **Erweiterung `brand_profiles`** - Neue Spalten:
   - `sitemap_urls`, `discovered_urls`, `crawl_config` JSONB
   - `market_position`, `industry_insights`, `external_perception`, `audience_insights`, `content_gaps` JSONB
   - `last_research_at`, `research_status`

5. **RLS Policies** für alle neuen Tabellen (Ownership via workspace)

6. **Trigger** für `updated_at` Spalten

**Deployment:**
```sql
-- Führe den kompletten Inhalt von supabase/migrations/20260109000000_brand_intelligence_system.sql aus
-- Via Supabase Dashboard: SQL Editor → New Query → Paste & Run
```

---

## 2. Edge Functions deployen

### Neue Functions:

| Function | Pfad | Beschreibung |
|----------|------|--------------|
| `brand-discover` | `supabase/functions/brand-discover/index.ts` | Haupt-Orchestrator für Full Brand Discovery |
| `brand-research-perplexity` | `supabase/functions/brand-research-perplexity/index.ts` | Perplexity Research Suite (6 Research-Typen) |
| `brand-job-status` | `supabase/functions/brand-job-status/index.ts` | Job Progress Endpoint |

### Neue Shared Utilities (werden automatisch mit Functions deployed):

| Utility | Pfad | Beschreibung |
|---------|------|--------------|
| `brand-research-types.ts` | `supabase/functions/_shared/brand-research-types.ts` | TypeScript Interfaces |
| `job-tracker.ts` | `supabase/functions/_shared/job-tracker.ts` | Progress-Tracking Klasse |
| `sitemap-parser.ts` | `supabase/functions/_shared/sitemap-parser.ts` | Sitemap + robots.txt Parser |
| `perplexity-client.ts` | `supabase/functions/_shared/perplexity-client.ts` | Perplexity API Client |
| `crawl-orchestrator.ts` | `supabase/functions/_shared/crawl-orchestrator.ts` | Firecrawl + ScrapeOwl Fallback |

### Deployment Commands:
```bash
# Alle neuen Functions deployen
npx supabase functions deploy brand-discover
npx supabase functions deploy brand-research-perplexity
npx supabase functions deploy brand-job-status
```

---

## 3. API Endpoints

### POST `/functions/v1/brand-discover`
**Full Brand Discovery starten**

```typescript
// Request
{
  projectId: string;
  websiteUrl: string;
  options?: {
    parseSitemap?: boolean;      // Default: true
    maxPages?: number;           // Default: 50
    runResearch?: boolean;       // Default: true
    researchTypes?: ResearchType[];
    priorityPaths?: string[];
    excludePaths?: string[];
  }
}

// Response
{
  success: boolean;
  jobId: string;      // UUID für Progress-Tracking
  message: string;
}
```

### POST `/functions/v1/brand-research-perplexity`
**Perplexity Research ausführen**

```typescript
// Request
{
  projectId: string;
  brandProfileId: string;
  researchTypes: (
    | 'market_analysis'
    | 'industry_trends'
    | 'brand_perception'
    | 'audience_insights'
    | 'content_gaps'
    | 'pricing_intelligence'
  )[];
  forceRefresh?: boolean;  // Cache umgehen
}

// Response
{
  success: boolean;
  results: Record<ResearchType, ResearchResult>;
  cached: ResearchType[];   // Diese kamen aus Cache
  fresh: ResearchType[];    // Diese wurden neu abgefragt
  errors: Array<{ type: ResearchType; error: string }>;
}
```

### GET `/functions/v1/brand-job-status?jobId={uuid}`
**Job Status abfragen**

```typescript
// Response
{
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;        // 0-100
  currentStep?: string;
  stepsCompleted: number;
  stepsTotal: number;
  result?: any;
  error?: string;
}
```

### GET `/functions/v1/brand-job-status?brandProfileId={uuid}&action=list`
**Alle Jobs eines Brand Profiles listen**

---

## 4. Environment Variables

Diese müssen in Supabase → Settings → Edge Functions → Secrets gesetzt sein:

```
PERPLEXITY_API_KEY=pplx-xxxxx
FIRECRAWL_API_KEY=fc-xxxxx
SCRAPEOWL_API_KEY=xxxxx
GEMINI_API_KEY=xxxxx
```

---

## 5. Frontend Integration

### React Hook Beispiel:

```typescript
// Brand Discovery starten
const startDiscovery = async (projectId: string, websiteUrl: string) => {
  const { data } = await supabase.functions.invoke('brand-discover', {
    body: { projectId, websiteUrl }
  });
  return data.jobId;
};

// Job Status pollen
const pollJobStatus = async (jobId: string) => {
  const { data } = await supabase.functions.invoke('brand-job-status', {
    body: {},
    headers: {}
  });
  // Nutze GET mit query params stattdessen:
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/brand-job-status?jobId=${jobId}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  return response.json();
};

// Research starten
const runResearch = async (brandProfileId: string, types: string[]) => {
  const { data } = await supabase.functions.invoke('brand-research-perplexity', {
    body: {
      projectId,
      brandProfileId,
      researchTypes: types
    }
  });
  return data;
};
```

### Neue Felder in `brand_profiles` für UI:

```typescript
interface BrandProfile {
  // ... existing fields ...

  // Neue Research-Felder
  market_position?: MarketAnalysisResult;
  industry_insights?: IndustryTrendsResult;
  external_perception?: BrandPerceptionResult;
  audience_insights?: AudienceInsightsResult;
  content_gaps?: ContentGapsResult;

  // Status
  research_status?: 'pending' | 'running' | 'completed' | 'failed';
  last_research_at?: string;

  // Discovery
  sitemap_urls?: string[];
  discovered_urls?: string[];
}
```

---

## 6. Deployment Reihenfolge

1. **Migration ausführen** (SQL im Dashboard)
2. **Edge Functions deployen** (CLI oder Dashboard)
3. **Secrets prüfen** (PERPLEXITY_API_KEY etc.)
4. **Testen** mit einem Projekt

---

## 7. Test-Aufruf

```bash
curl -X POST 'https://vmrtentqpbvvqkgsilgk.supabase.co/functions/v1/brand-discover' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "websiteUrl": "https://example.com",
    "options": {
      "maxPages": 20,
      "researchTypes": ["market_analysis", "brand_perception"]
    }
  }'
```
