# Lovable - Datenbank & Deployment Anleitung

## Aktuelle Aufgabe: WordPress Integration

### 1. Datenbank-Migration ausführen

Bitte führe folgende SQL-Migration in der Supabase-Datenbank aus:

```sql
-- WordPress integration fields for credentials storage
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS wp_username TEXT,
ADD COLUMN IF NOT EXISTS wp_app_password TEXT,
ADD COLUMN IF NOT EXISTS wp_site_name TEXT,
ADD COLUMN IF NOT EXISTS wp_is_verified BOOLEAN DEFAULT false;

-- Index for faster WordPress integration lookups
CREATE INDEX IF NOT EXISTS integrations_wordpress_idx
ON public.integrations(project_id)
WHERE type = 'wordpress';
```

### 2. Deployment

Nach der Datenbank-Migration bitte das Frontend neu deployen. Die folgenden Dateien wurden geändert:

**Neue Dateien:**
- `src/components/settings/WordPressSetup.tsx` - WordPress Konfigurationsformular
- `supabase/migrations/20260103200000_add_wordpress_integration_fields.sql`

**Geänderte Dateien:**
- `src/pages/Settings.tsx` - WordPress-Integration aktiviert
- `src/hooks/useProjectIntegrations.tsx` - WordPress-Daten laden/speichern
- `src/integrations/supabase/types.ts` - TypeScript-Typen erweitert

### 3. Testen

Nach dem Deployment:
1. Gehe zu Einstellungen → Integrationen
2. WordPress-Karte sollte aktiv sein (nicht mehr ausgegraut)
3. Klicke auf "WordPress verbinden"
4. Gib WordPress URL, Benutzername und App-Password ein
5. Klicke auf "Verbindung testen & speichern"

---

## Allgemeine Anleitung für zukünftige Updates

### Datenbank-Änderungen

Wenn neue Migrations-Dateien in `supabase/migrations/` hinzugefügt wurden:

1. Öffne die neueste `.sql` Datei im Ordner `supabase/migrations/`
2. Kopiere den SQL-Inhalt
3. Sage Lovable: "Bitte führe diese SQL-Migration aus: [SQL hier einfügen]"

### Frontend-Deployment

Nach Code-Änderungen:
1. Sage Lovable: "Bitte deploye die neuesten Änderungen von main"
2. Oder: "Pull the latest changes and deploy"

### Fehlerbehebung

Bei 401/403 Fehlern:
- Ausloggen und neu einloggen
- Cache leeren (Strg+Shift+R)

Bei Datenbank-Fehlern:
- Prüfen ob Migration ausgeführt wurde
- Supabase Logs in Lovable prüfen
