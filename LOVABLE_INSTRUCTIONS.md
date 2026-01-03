# Lovable - Datenbank & Deployment Anleitung

## Automatisches Edge Function Deployment (GitHub Actions)

Edge Functions werden jetzt automatisch bei jedem Push deployed!

### Einmalige Einrichtung: GitHub Secrets

Gehe zu **GitHub Repository → Settings → Secrets and variables → Actions** und füge hinzu:

| Secret Name | Wert | Wo finden? |
|-------------|------|------------|
| `SUPABASE_ACCESS_TOKEN` | Dein persönlicher Access Token | [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | Projekt-Referenz (z.B. `abcdefghijklmnop`) | Supabase Dashboard → Project Settings → General → Reference ID |

### Wie es funktioniert

1. **Automatisch:** Bei jedem Push zu `main` oder `feature/wordpress-integration` mit Änderungen in `supabase/functions/`
2. **Manuell:** GitHub → Actions → "Deploy Supabase Edge Functions" → "Run workflow"

### Manuelles Deployment (falls nötig)

Falls GitHub Actions nicht funktioniert, sage Lovable:
```
Deploy all Supabase Edge Functions from the repository
```

---

## Neue Funktion: In-App Migration System

Ab sofort können Datenbank-Migrationen direkt in der App ausgeführt werden!

**So geht's:**
1. Gehe zu **Einstellungen** (Settings)
2. Klicke auf den Tab **"System"**
3. Unter "Datenbank-Migrationen" siehst du alle verfügbaren Migrationen
4. Klicke auf **"Migrationen ausführen"** um ausstehende Migrationen zu starten

**Vorteile:**
- Kein manuelles SQL mehr nötig
- Sichere Ausführung über Edge Function
- Audit Trail wer wann was ausgeführt hat

---

## Aktuelle Aufgabe: WordPress Integration

### 1. Edge Function deployen

Die neue Edge Function `run-migrations` muss deployed werden:

```bash
# Im Lovable Dashboard unter "Edge Functions"
# Oder sage Lovable: "Deploy the run-migrations edge function"
```

### 2. Initiale Migration (einmalig)

Da das Migration-System selbst noch nicht in der DB ist, muss diese SQL einmalig manuell ausgeführt werden:

```sql
-- Migration tracking table (nur einmal nötig)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view migrations"
  ON public.schema_migrations FOR SELECT TO authenticated USING (true);
```

Danach können alle weiteren Migrationen über die App ausgeführt werden!

### 3. Testen

Nach dem Deployment:
1. Gehe zu Einstellungen -> System
2. Du solltest die Migration-Liste sehen
3. Klicke auf "Migrationen ausführen"
4. WordPress-Felder sollten jetzt verfügbar sein

---

## Für zukünftige Updates

### Code-Änderungen mit neuen Migrationen

1. **Migration im Code hinzufügen:**
   - Neue Migration in `supabase/functions/run-migrations/index.ts` unter `MIGRATIONS` hinzufügen

2. **Deployen:**
   - Sage Lovable: "Deploy the run-migrations edge function"
   - Oder: "Pull latest changes and deploy"

3. **Migration ausführen:**
   - User geht zu Settings -> System
   - Klickt "Migrationen ausführen"

### Ohne In-App System (Fallback)

Falls das In-App System nicht funktioniert:

1. Öffne die neueste `.sql` Datei im Ordner `supabase/migrations/`
2. Kopiere den SQL-Inhalt
3. Sage Lovable: "Bitte führe diese SQL-Migration aus: [SQL hier einfügen]"

---

## Fehlerbehebung

### "Edge Function not found"
- run-migrations Edge Function muss deployed werden
- Sage Lovable: "Deploy all edge functions"

### 401/403 Fehler
- Ausloggen und neu einloggen
- Cache leeren (Strg+Shift+R)

### Migration schlägt fehl
- Prüfe Supabase Logs
- SQL verwendet `IF NOT EXISTS` - kann mehrfach ausgeführt werden
