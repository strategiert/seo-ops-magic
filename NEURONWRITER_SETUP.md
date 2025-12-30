# NeuronWriter API Setup

## Problem: 403 Forbidden Error

Wenn Sie einen **403 Forbidden Error** bei der NeuronWriter-Integration sehen, liegt das höchstwahrscheinlich daran, dass der API Key nicht korrekt konfiguriert ist.

## Lösung: API Key als Supabase Secret setzen

### Schritt 1: NeuronWriter API Key erhalten

1. Gehe zu [NeuronWriter](https://app.neuronwriter.com)
2. Klicke auf dein **Profil-Icon** (oben rechts)
3. Wähle **"Profile"** → **"Neuron API Access"**
4. Klicke auf **"Generate New API Key"**
5. Kopiere den generierten API Key

**Wichtig:** Du benötigst einen **Gold Plan oder höher** für API-Zugang.

### Schritt 2: API Key in Supabase Secrets setzen

#### Option A: Via Supabase CLI (lokal)

```bash
# Installiere Supabase CLI falls noch nicht vorhanden
npm install -g supabase

# Setze den API Key als Secret
supabase secrets set NEURONWRITER_API_KEY=dein_api_key_hier

# Prüfe ob das Secret gesetzt wurde
supabase secrets list
```

#### Option B: Via Supabase Dashboard (Web)

1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt: **vmrtentqpbvvqkgsilgk**
3. Navigiere zu **Settings** → **Edge Functions** → **Manage secrets**
4. Füge ein neues Secret hinzu:
   - **Name:** `NEURONWRITER_API_KEY`
   - **Value:** Dein NeuronWriter API Key
5. Klicke **Add secret**

### Schritt 3: Edge Functions neu deployen (falls nötig)

Wenn du lokale Änderungen hast, deploye die Edge Functions neu:

```bash
# Deploye alle Edge Functions
supabase functions deploy neuronwriter-api

# Oder deploye alle Functions
supabase functions deploy
```

### Schritt 4: Testen

1. Gehe zu **Settings** → **Integrationen** in der App
2. Klicke auf **"NeuronWriter verbinden"**
3. Wenn der API Key korrekt ist, sollten deine NeuronWriter-Projekte geladen werden

## Debugging

### Browser Console prüfen

Öffne die Browser Developer Tools (F12) und schaue in die Console. Mit den verbesserten Error-Messages solltest du jetzt sehen:

- **500 Error mit "NeuronWriter API key not configured"**: API Key ist nicht gesetzt
- **403 Error mit Details**: API Key ist ungültig oder NeuronWriter lehnt die Anfrage ab
- Detaillierte Fehlermeldungen von der NeuronWriter API

### Supabase Logs prüfen

```bash
# Schaue die Edge Function Logs an
supabase functions logs neuronwriter-api --limit 50

# Oder live logs
supabase functions logs neuronwriter-api --follow
```

## API Dokumentation

Die Integration basiert auf der offiziellen NeuronWriter API v0.5:
- Base URL: `https://app.neuronwriter.com/neuron-api/0.5/writer`
- Authentifizierung: `X-API-KEY` Header
- Dokumentation: https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/

## Unterstützte Endpunkte

- ✅ `/list-projects` - Liste aller Projekte
- ✅ `/list-queries` - Liste aller Queries in einem Projekt
- ✅ `/new-query` - Neue Keyword-Analyse starten
- ✅ `/get-query` - Query-Ergebnisse abrufen
- ✅ `/evaluate-content` - Content evaluieren

## Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| 403 Forbidden | API Key ungültig/nicht gesetzt | API Key in Supabase Secrets setzen |
| 500 "API key not configured" | Secret nicht gesetzt | `supabase secrets set NEURONWRITER_API_KEY=...` |
| 400 Bad Request | Fehlende Parameter | Logs prüfen, Parameter korrigieren |
| Analysis timeout | Query dauert zu lange | Warten oder maxAttempts erhöhen |

## Support

Bei weiteren Problemen:
1. Browser Console Logs prüfen (F12)
2. Supabase Edge Function Logs prüfen
3. NeuronWriter API Status prüfen: https://neuronwriter.com
