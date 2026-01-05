# Edge Function Deployment Guide

## AKTUELL ZU DEPLOYEN (05.01.2026)

### Priorität HOCH:
```
supabase functions deploy brand-crawl
supabase functions deploy brand-crawl-webhook
supabase functions deploy wordpress-publish
```

### Migration ausführen:
```sql
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS crawl_job_id TEXT;
CREATE INDEX IF NOT EXISTS idx_brand_profiles_crawl_job_id ON public.brand_profiles(crawl_job_id);
```

---

## Alle Edge Functions

### Diese Edge Functions müssen deployed werden:

| Function | Grund | Priorität |
|----------|-------|-----------|
| `brand-crawl` | Webhook-Pattern statt Polling | **HOCH** |
| `brand-crawl-webhook` | **NEU** - Empfängt Firecrawl Daten | **HOCH** |
| `brand-analyze` | Nutzt neue Model-Namen | **HOCH** |
| `generate-article` | Nutzt model-router | MITTEL |
| `generate-html-export` | Nutzt model-router | MITTEL |
| `wordpress-publish` | Nutzt model-router | MITTEL |

**Hinweis:** `_shared/model-router.ts` wird automatisch mit jeder Function deployed.

### Datenbank-Migration erforderlich:
```sql
-- Migration: 20260104100000_add_crawl_job_id.sql
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS crawl_job_id TEXT;
CREATE INDEX IF NOT EXISTS idx_brand_profiles_crawl_job_id ON public.brand_profiles(crawl_job_id);
```

---

## Änderungen

### 1. Model-Router - Stabile Model-Namen
```
gemini-2.5-pro        → Artikel, Brand-Analyse (Premium)
gemini-2.5-flash      → HTML, Code, Recherche (Balanced)
gemini-2.5-flash-lite → Übersetzungen, Summaries (Budget)
gemini-2.0-flash-exp  → Bildgenerierung (Nano Banana)
```

### 2. Brand-Crawl - Webhook-Pattern (kein Timeout mehr!)
**Problem gelöst:** Edge Functions haben 60s Timeout, Crawls dauern länger.

**Lösung: Webhook statt Polling**
```
1. brand-crawl       → Startet Firecrawl mit webhook URL, kehrt sofort zurück
2. Firecrawl         → Crawlt im Hintergrund (kann 10 Min dauern)
3. brand-crawl-webhook → Empfängt Daten, speichert, triggert Analyse
```

- **Firecrawl API v2** mit `webhook` Parameter
- Kein Polling mehr → kein Timeout
- Status-Flow: `crawling` → (webhook) → `analyzing` → `completed`

---

## Automatisches Deployment (Lovable.dev)

Wenn Sie Lovable.dev verwenden, werden Edge Functions automatisch deployed, wenn Sie Code pushen.

**Warten Sie 2-3 Minuten** nach dem Push, dann sollte die neue Version live sein.

---

## Manuelles Deployment (Supabase CLI)

```bash
# Supabase CLI installieren (falls noch nicht installiert)
npm install -g supabase

# Login
supabase login

# Link zu Ihrem Projekt
supabase link --project-ref YOUR_PROJECT_REF

# Alle Functions deployen
supabase functions deploy

# Oder einzeln:
supabase functions deploy brand-crawl
supabase functions deploy brand-analyze
supabase functions deploy generate-article
supabase functions deploy generate-html-export
supabase functions deploy wordpress-publish
```

---

## Wichtige Secrets (müssen in Supabase gesetzt sein)

| Secret | Beschreibung |
|--------|--------------|
| `GEMINI_API_KEY` | Google AI API Key für Gemini Models |
| `FIRECRAWL_API_KEY` | Firecrawl API Key für Website Crawling |
| `SUPABASE_URL` | Automatisch gesetzt |
| `SUPABASE_ANON_KEY` | Automatisch gesetzt |
| `SUPABASE_SERVICE_ROLE_KEY` | Automatisch gesetzt |

---

## Kosten-Übersicht

| Task | Model | Input/1M Token | Output/1M Token |
|------|-------|----------------|-----------------|
| Artikel-Generierung | `gemini-2.5-pro` | $1.25 | $10.00 |
| Brand-Analyse | `gemini-2.5-pro` | $1.25 | $10.00 |
| HTML-Design | `gemini-2.5-flash` | $0.30 | $2.50 |
| Code-Generierung | `gemini-2.5-flash` | $0.30 | $2.50 |
| Übersetzungen | `gemini-2.5-flash-lite` | $0.10 | $0.40 |
| Zusammenfassungen | `gemini-2.5-flash-lite` | $0.10 | $0.40 |
| Bildgenerierung | `gemini-2.0-flash-exp` | - | $0.04/Bild |

---

## Fehlersuche

### 1. Logs in Supabase Dashboard prüfen

1. Gehen Sie zu: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Wählen Sie die Edge Function
3. Klicken Sie auf "Logs"
4. Sehen Sie die Fehlermeldungen

### 2. Häufige Fehler

**500 Error:**
- Edge Function ist noch nicht deployed (warten Sie 2-3 Minuten)
- GEMINI_API_KEY fehlt (setzen Sie in Supabase → Settings → Edge Functions → Secrets)
- Model-Name ungültig (sollte mit diesem Update behoben sein)

**404 Error:**
- Resource existiert nicht in der Datenbank
- Falsche URL

**402 Error:**
- Gemini API Credits aufgebraucht
- Prüfen Sie Ihr Google Cloud Billing
