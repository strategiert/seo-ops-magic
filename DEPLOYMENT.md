# Edge Function Deployment Guide

## Automatisches Deployment (Lovable.dev)

Wenn Sie Lovable.dev verwenden, werden Edge Functions automatisch deployed, wenn Sie Code pushen.

**Warten Sie 2-3 Minuten** nach dem Push, dann sollte die neue Version live sein.

## Manuelles Deployment (Supabase CLI)

Falls Sie die Edge Function manuell deployen möchten:

```bash
# Supabase CLI installieren (falls noch nicht installiert)
npm install -g supabase

# Login
supabase login

# Link zu Ihrem Projekt
supabase link --project-ref YOUR_PROJECT_REF

# Edge Function deployen
supabase functions deploy generate-article
```

## Fehlersuche

### 1. Logs in Supabase Dashboard prüfen

1. Gehen Sie zu: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Wählen Sie `generate-article`
3. Klicken Sie auf "Logs"
4. Sehen Sie die Fehlermeldungen

### 2. Lokales Testen

Sie können die Edge Function lokal testen:

```bash
# Edge Function lokal starten
supabase functions serve generate-article

# In einem anderen Terminal:
curl -X POST http://localhost:54321/functions/v1/generate-article \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"briefId": "5839afb0-42c8-4cc5-9f4b-c65860c4c8fb"}'
```

### 3. Häufige Fehler

**500 Error:**
- Edge Function ist noch nicht deployed (warten Sie 2-3 Minuten)
- LOVABLE_API_KEY fehlt (setzen Sie in Supabase → Settings → Edge Functions → Secrets)
- Datenbank-Verbindung fehlgeschlagen

**404 Error:**
- Brief ID existiert nicht in der Datenbank
- Falsche URL

**402 Error:**
- Lovable AI Credits aufgebraucht
- Fügen Sie Credits hinzu: https://lovable.dev/billing

## Aktueller Status

✅ Code wurde gefixt:
- `transformNWGuidelines()` hinzugefügt
- Bug mit `q.question` → `q` behoben
- Unterstützt alte DB-Datenstruktur

📦 Deployment-Status:
- Prüfen Sie in Supabase Dashboard → Functions → generate-article
- Sollte automatisch von Lovable deployed werden
