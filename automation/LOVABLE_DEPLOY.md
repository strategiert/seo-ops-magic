# Lovable Deploy Anleitung

So verwendest du das WordPress Automation System mit Lovable.

## Wichtig zu verstehen

Das `/automation` Projekt ist ein **separates Backend-System** (Node.js/TypeScript), das **nicht direkt in Lovable deployt wird**. Lovable hostet nur die React-Frontend-App.

Das Automation-System läuft separat auf einem Server oder als GitHub Action.

---

## Setup-Optionen

### Option A: Lokale Nutzung (Empfohlen)

Die einfachste Methode ist, das Automation-Script lokal auf deinem Computer zu nutzen:

#### 1. Projekt lokal klonen

```bash
# Projekt von GitHub klonen
git clone <your-repo-url>
cd seo-ops-magic/automation
```

#### 2. Dependencies installieren

```bash
npm install
```

#### 3. Environment Variables

```bash
cp .env.example .env
# Bearbeite .env mit deinen Credentials
```

**Credentials beschaffen:**

**WordPress Application Password:**
1. Gehe zu deinem WordPress Admin
2. Benutzer → Profil
3. Scrolle zu "Anwendungspasswörter"
4. Name: "SEO Ops Automation"
5. Klick "Neues Anwendungspasswort hinzufügen"
6. Kopiere das generierte Passwort

**Supabase Service Role Key:**
1. Gehe zu deinem Supabase Dashboard
2. Settings → API
3. Kopiere den **service_role** Key (nicht anon!)

**Anthropic API Key:**
1. Gehe zu https://console.anthropic.com/
2. Account Settings → API Keys
3. Create Key

#### 4. Build & Run

```bash
# TypeScript kompilieren
npm run build

# Artikel veröffentlichen
npm run publish-article -- --article-id <uuid-aus-lovable-app>
```

#### 5. Article ID aus Lovable App kopieren

1. Öffne deine Lovable App im Browser
2. Gehe zu Articles
3. Klicke auf einen Artikel
4. Kopiere die UUID aus der URL: `/articles/{UUID}`
5. Nutze diese UUID im Publish-Script

---

### Option B: GitHub Actions (Automatisiert)

Für automatisches Publishing ohne lokale Ausführung.

#### 1. GitHub Secrets konfigurieren

In deinem GitHub Repository:

1. Gehe zu: **Settings** → **Secrets and variables** → **Actions**
2. Klicke **New repository secret**
3. Füge folgende Secrets hinzu:

| Name | Wert |
|------|------|
| `WORDPRESS_URL` | `https://deine-wordpress-seite.com` |
| `WORDPRESS_USERNAME` | Dein WP Admin Username |
| `WORDPRESS_APP_PASSWORD` | Application Password (siehe oben) |
| `SUPABASE_URL` | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key |
| `ANTHROPIC_API_KEY` | Dein Anthropic Key |

#### 2. Workflow File committen

Der Workflow ist bereits erstellt. Du musst ihn nur in Lovable committen:

```bash
# In Lovable Terminal (unten links)
cd /home/user/seo-ops-magic

# Workflow File erstellen
mkdir -p .github/workflows
```

Dann in Lovable eine neue Datei erstellen:
`.github/workflows/publish-articles.yml`

Inhalt kopieren aus `automation/DEPLOY.md` → Option 4.

#### 3. Workflow pushen

```bash
git add .github/workflows/publish-articles.yml
git commit -m "Add WordPress publishing workflow"
git push
```

#### 4. Manuell triggern

1. Gehe zu deinem GitHub Repo
2. Klicke auf **Actions** Tab
3. Wähle **Publish Articles to WordPress**
4. Klicke **Run workflow**
5. Gib optional Article ID ein
6. Klicke **Run workflow** (grüner Button)

---

### Option C: Integration in Lovable App (UI Button)

Du kannst einen "Publish to WordPress" Button direkt in die Lovable App einbauen:

#### 1. Neue Supabase Edge Function

In Lovable, erstelle einen neuen Prompt:

```
Erstelle eine neue Supabase Edge Function namens "trigger-wordpress-publish"
die einen Webhook aufruft, um das WordPress Publishing zu triggern.

Die Function soll:
1. articleId als Parameter empfangen
2. Den Webhook aufrufen mit articleId
3. Success/Error zurückgeben

Environment Variable: PUBLISHING_WEBHOOK_URL
```

#### 2. Button in ArticleDetail hinzufügen

Bitte Lovable, einen Button hinzuzufügen:

```
Füge einen "Publish to WordPress" Button in ArticleDetail.tsx hinzu,
der die Edge Function "trigger-wordpress-publish" aufruft.

Der Button soll:
- Neben "HTML Export" und "Elementor Template" platziert werden
- Loading State zeigen während Publishing
- Toast Notification bei Success/Error
```

#### 3. Webhook Server einrichten

Du benötigst einen Webhook-Empfänger, z.B. mit Zapier, Make.com oder eigenem Server:

**Mit Make.com (früher Integromat):**
1. Erstelle neues Scenario
2. Webhook Trigger → Custom Webhook
3. Copy Webhook URL
4. Aktion: HTTP Request zu deinem Server mit `npm run publish-article`

**Oder einfacher: Direkt Server-basiert (siehe Option A)**

---

## Empfohlener Workflow für Lovable Nutzer

### Für Development:
→ **Option A (Lokal)** - Am einfachsten zum Testen

### Für Production:
→ **Option B (GitHub Actions)** - Automatisiert ohne eigenen Server

### Für nahtlose Integration:
→ **Option C (UI Button)** - Beste User Experience, aber komplexer Setup

---

## Schritt-für-Schritt: Erste Nutzung

### 1. WordPress vorbereiten

```
✓ ACF Pro Plugin installieren
✓ ACF Field "custom_html_content" erstellen (Textarea)
✓ Application Password generieren
```

### 2. Lokales Setup

```bash
cd seo-ops-magic/automation
npm install
cp .env.example .env
# .env editieren
npm run build
```

### 3. Ersten Artikel publishen

```bash
# In Lovable App: Artikel öffnen, UUID aus URL kopieren
# Dann lokal:
npm run publish-article -- --article-id <UUID> --status draft
```

### 4. In WordPress prüfen

```
1. Gehe zu WP Admin → Beiträge
2. Öffne den neuen Entwurf
3. Custom Fields → custom_html_content sollte HTML enthalten
4. Veröffentlichen
```

---

## Lovable-spezifische Tipps

### Environment Variables in Lovable

Lovable hat kein `/automation` Deployment - nutze daher:

**Für Frontend (wenn du Webhook nutzt):**
```typescript
// In Lovable .env
VITE_PUBLISHING_WEBHOOK_URL=https://your-webhook-url.com
```

**Für Edge Functions:**
```bash
# In Supabase Dashboard → Edge Functions → Secrets
WORDPRESS_URL=...
WORDPRESS_USERNAME=...
WORDPRESS_APP_PASSWORD=...
```

### Debugging in Lovable

```typescript
// In ArticleDetail.tsx
const publishToWordPress = async () => {
  console.log('Publishing article:', id);

  const { data, error } = await supabase.functions.invoke('trigger-wordpress-publish', {
    body: { articleId: id }
  });

  console.log('WordPress publish result:', data, error);
};
```

### Database Migration in Lovable

Der Migration-File ist bereits erstellt. Um ihn anzuwenden:

1. Gehe zu Supabase Dashboard
2. SQL Editor
3. Kopiere Inhalt von `supabase/migrations/20260103170000_add_wp_post_id.sql`
4. Run

Oder in Lovable:

```
Bitte führe die Migration aus:
supabase/migrations/20260103170000_add_wp_post_id.sql
```

---

## Kosten-Übersicht

| Komponente | Kosten |
|------------|--------|
| Lovable Hosting (Frontend) | Im Plan enthalten |
| Supabase (Database) | Free Tier meist ausreichend |
| WordPress Hosting | Je nach Provider (€5-50/Monat) |
| Anthropic Claude API | ~$0.05 per Artikel |
| Server für Automation | €5/Monat (VPS) ODER kostenlos (GitHub Actions) |

**Empfehlung:** Nutze GitHub Actions (kostenlos für öffentliche Repos, 2000 Min/Monat für private).

---

## Häufige Fragen

**Q: Muss ich das Automation-Projekt separat deployen?**
A: Ja, es läuft nicht in Lovable. Nutze entweder lokal, GitHub Actions oder eigenen Server.

**Q: Kann ich das direkt in Lovable integrieren?**
A: Nur über Supabase Edge Functions + Webhook. Siehe Option C.

**Q: Wie viele Artikel kann ich auf einmal publishen?**
A: GitHub Actions: ~50 (Timeout nach 6h), Lokal: unbegrenzt

**Q: Kostet das extra?**
A: Claude API Calls kosten ~$0.05/Artikel. Rest ist meist kostenlos.

**Q: Brauche ich einen eigenen Server?**
A: Nein, GitHub Actions funktioniert ohne Server (bis 2000 Min/Monat kostenlos).

---

## Quick Start Cheat Sheet

```bash
# Setup (einmalig)
cd seo-ops-magic/automation
npm install
cp .env.example .env
# .env editieren
npm run build

# Publishing (jedes Mal)
npm run publish-article -- --article-id <UUID>

# Batch Publishing
npm run publish-article -- --project-id <UUID>

# Als Published Status
npm run publish-article -- --article-id <UUID> --status publish

# Logs anschauen
npm run publish-article -- --article-id <UUID> 2>&1 | tee publish.log
```

---

## Support

Bei Problemen:
1. Prüfe `automation/README.md` für Details
2. Prüfe `automation/DEPLOY.md` für Deployment-Optionen
3. Prüfe Logs: `npm run publish-article` zeigt alle Errors

Viel Erfolg! 🚀
