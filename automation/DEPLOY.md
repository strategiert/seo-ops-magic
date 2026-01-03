# Deploy Anleitung - WordPress Automation

Diese Anleitung erklärt verschiedene Deployment-Optionen für das WordPress Automation System.

## Option 1: Lokale Nutzung (Empfohlen für Start)

### 1. Repository klonen

```bash
git clone <your-repo-url>
cd seo-ops-magic/automation
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables konfigurieren

```bash
cp .env.example .env
```

Bearbeite `.env` mit deinen Credentials:

```env
# WordPress
WORDPRESS_URL=https://deine-wordpress-seite.com
WORDPRESS_USERNAME=dein-username
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Supabase
SUPABASE_URL=https://dein-projekt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key

# LLM (Anthropic oder OpenAI)
ANTHROPIC_API_KEY=dein-anthropic-key
# ODER
# OPENAI_API_KEY=dein-openai-key

# Optional
DEFAULT_LANGUAGE=de
SUPPORTED_LANGUAGES=de,en,fr
```

### 4. TypeScript kompilieren

```bash
npm run build
```

### 5. Artikel veröffentlichen

```bash
# Einzelner Artikel
npm run publish-article -- --article-id abc-123-def

# Alle approved Artikel
npm run publish-article -- --project-id xyz-789
```

---

## Option 2: Server Deployment (für regelmäßiges Publishing)

### Voraussetzungen

- Linux Server (Ubuntu/Debian)
- Node.js 18+ installiert
- Git installiert

### 1. Server Setup

```bash
# SSH auf Server
ssh user@your-server.com

# Node.js installieren (falls nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git installieren
sudo apt-get install git -y
```

### 2. Repository klonen

```bash
cd /opt
sudo git clone <your-repo-url> seo-ops-magic
cd seo-ops-magic/automation
sudo chown -R $USER:$USER .
```

### 3. Installation

```bash
npm install
npm run build
```

### 4. Environment Variables

```bash
cp .env.example .env
nano .env  # Credentials eintragen
```

### 5. Cron Job einrichten (täglich um 2 Uhr nachts)

```bash
crontab -e
```

Füge hinzu:

```cron
# WordPress Auto-Publishing (täglich 2:00 Uhr)
0 2 * * * cd /opt/seo-ops-magic/automation && /usr/bin/npm run publish-article >> /var/log/wp-auto-publish.log 2>&1

# Wöchentlich alle Projekte (Sonntag 3:00 Uhr)
0 3 * * 0 cd /opt/seo-ops-magic/automation && /usr/bin/npm run publish-article -- --status publish >> /var/log/wp-auto-publish.log 2>&1
```

### 6. Logging einrichten

```bash
sudo touch /var/log/wp-auto-publish.log
sudo chown $USER:$USER /var/log/wp-auto-publish.log
```

### 7. Test

```bash
npm run publish-article -- --article-id <test-id>
tail -f /var/log/wp-auto-publish.log
```

---

## Option 3: Docker Deployment

### 1. Dockerfile erstellen

Erstelle `automation/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Source Code
COPY . .

# Build TypeScript
RUN npm run build

# Run as non-root
USER node

CMD ["node", "dist/scripts/publishArticle.js"]
```

### 2. Docker Compose (optional)

Erstelle `automation/docker-compose.yml`:

```yaml
version: '3.8'

services:
  wordpress-publisher:
    build: .
    environment:
      - WORDPRESS_URL=${WORDPRESS_URL}
      - WORDPRESS_USERNAME=${WORDPRESS_USERNAME}
      - WORDPRESS_APP_PASSWORD=${WORDPRESS_APP_PASSWORD}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

### 3. Build & Run

```bash
# Build
docker build -t wp-automation .

# Run einzelner Artikel
docker run --env-file .env wp-automation \
  npm run publish-article -- --article-id abc-123

# Mit Docker Compose
docker-compose up -d
```

---

## Option 4: GitHub Actions (Automatisiert)

### 1. GitHub Secrets einrichten

Gehe zu: Repository → Settings → Secrets and variables → Actions

Füge hinzu:
- `WORDPRESS_URL`
- `WORDPRESS_USERNAME`
- `WORDPRESS_APP_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

### 2. Workflow erstellen

Erstelle `.github/workflows/publish-articles.yml`:

```yaml
name: Publish Articles to WordPress

on:
  schedule:
    # Täglich um 2:00 UTC
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      article_id:
        description: 'Article ID to publish (optional)'
        required: false
      project_id:
        description: 'Project ID (optional)'
        required: false
      status:
        description: 'WordPress status (draft/publish)'
        default: 'draft'
        required: true

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: automation/package-lock.json

      - name: Install dependencies
        working-directory: ./automation
        run: npm ci

      - name: Build TypeScript
        working-directory: ./automation
        run: npm run build

      - name: Publish articles
        working-directory: ./automation
        env:
          WORDPRESS_URL: ${{ secrets.WORDPRESS_URL }}
          WORDPRESS_USERNAME: ${{ secrets.WORDPRESS_USERNAME }}
          WORDPRESS_APP_PASSWORD: ${{ secrets.WORDPRESS_APP_PASSWORD }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          if [ -n "${{ github.event.inputs.article_id }}" ]; then
            npm run publish-article -- --article-id ${{ github.event.inputs.article_id }} --status ${{ github.event.inputs.status }}
          elif [ -n "${{ github.event.inputs.project_id }}" ]; then
            npm run publish-article -- --project-id ${{ github.event.inputs.project_id }} --status ${{ github.event.inputs.status }}
          else
            npm run publish-article -- --status ${{ github.event.inputs.status || 'draft' }}
          fi
```

### 3. Manuell triggern

- Gehe zu: Actions → Publish Articles to WordPress → Run workflow
- Gib Article ID oder Project ID ein (optional)
- Wähle Status (draft/publish)
- Click "Run workflow"

---

## Option 5: Supabase Edge Function (Alternative)

Falls du das Publishing direkt aus Supabase triggern möchtest:

### 1. Edge Function erstellen

```bash
# In deinem Projekt
supabase functions new publish-to-wordpress
```

### 2. Function Code

Erstelle `supabase/functions/publish-to-wordpress/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();

    // Hier müsstest du die WordPress Publishing Logik implementieren
    // Alternative: Trigger externes System via Webhook

    const webhookUrl = Deno.env.get("PUBLISHING_WEBHOOK_URL");

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, action: "publish" }),
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Empfohlene Setup-Strategie

### Für Development/Testing
→ **Option 1: Lokal** - Schnell und einfach zu debuggen

### Für Production (kleines Team)
→ **Option 2: Server mit Cron** - Zuverlässig und wartbar

### Für Production (größeres Team)
→ **Option 4: GitHub Actions** - Versioniert, transparent, CI/CD integriert

### Für Containerized Infrastructure
→ **Option 3: Docker** - Portabel, skalierbar

---

## Monitoring & Logging

### Logs überprüfen (Server)

```bash
# Echtzeit
tail -f /var/log/wp-auto-publish.log

# Letzte 100 Zeilen
tail -n 100 /var/log/wp-auto-publish.log

# Fehler filtern
grep -i error /var/log/wp-auto-publish.log
```

### Benachrichtigungen bei Fehlern

Erweitere dein Cron-Script mit Email-Benachrichtigung:

```bash
# Crontab
0 2 * * * cd /opt/seo-ops-magic/automation && /usr/bin/npm run publish-article 2>&1 | tee -a /var/log/wp-auto-publish.log | grep -i error && echo "WordPress Publishing Error" | mail -s "WP Automation Failed" admin@yourdomain.com
```

---

## Troubleshooting

### Problem: "Module not found"
```bash
# Lösung: Dependencies neu installieren
cd automation
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: "Permission denied"
```bash
# Lösung: Berechtigungen setzen
sudo chown -R $USER:$USER /opt/seo-ops-magic
chmod +x automation/dist/scripts/publishArticle.js
```

### Problem: WordPress Authentication Error
```bash
# Lösung: Application Password prüfen
# 1. Neues App Password in WordPress erstellen
# 2. .env aktualisieren
# 3. Script neu starten
```

### Problem: Supabase Connection Error
```bash
# Lösung: Service Role Key prüfen
# 1. Supabase Dashboard → Settings → API
# 2. Service Role Key kopieren (nicht anon key!)
# 3. .env aktualisieren
```

---

## Updates deployen

### Server
```bash
ssh user@your-server.com
cd /opt/seo-ops-magic
git pull origin main
cd automation
npm install
npm run build
```

### Docker
```bash
docker-compose down
git pull origin main
docker-compose build
docker-compose up -d
```

### GitHub Actions
- Push to main branch
- Actions werden automatisch mit neuestem Code laufen

---

## Sicherheit

### Best Practices

1. **Environment Variables niemals committen**
   ```bash
   # .env ist bereits in .gitignore
   ```

2. **Service Role Key rotieren** (alle 90 Tage)
   - Supabase Dashboard → Settings → API → Generate new key

3. **WordPress App Password rotieren** (alle 90 Tage)
   - WP Admin → User → Application Passwords → Revoke & Create new

4. **Server absichern**
   ```bash
   # Firewall
   sudo ufw allow 22
   sudo ufw enable

   # Fail2ban
   sudo apt-get install fail2ban
   ```

5. **Logs rotieren**
   ```bash
   sudo nano /etc/logrotate.d/wp-automation
   ```

   ```
   /var/log/wp-auto-publish.log {
       daily
       rotate 14
       compress
       missingok
       notifempty
   }
   ```

---

## Support & Wartung

### Regelmäßige Checks

- **Wöchentlich**: Logs auf Fehler prüfen
- **Monatlich**: Dependencies updaten (`npm outdated`)
- **Quartalsweise**: Credentials rotieren
- **Bei Bedarf**: Disk Space prüfen (Logs)

### Updates

```bash
# Dependencies aktualisieren
npm outdated
npm update
npm audit fix

# TypeScript rebuilden
npm run build
```

---

## Kontakt

Bei Fragen oder Problemen:
- GitHub Issues: <your-repo>/issues
- Email: <your-email>
