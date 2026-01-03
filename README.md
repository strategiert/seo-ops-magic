# SEO Ops Magic 🚀

**Professionelles SEO Content Management System mit automatisierter WordPress-Integration**

SEO Ops Magic ist eine moderne, KI-gestützte Content-Management-Plattform für SEO-Teams. Das System vereint Content-Erstellung, NeuronWriter-Integration, Elementor-Template-Generierung und automatisches WordPress-Publishing in einer nahtlosen Workflow-Lösung.

---

## ✨ Features

### 📝 Content Management
- **Projekt- & Brief-Verwaltung**: Organisiere SEO-Projekte und Content-Briefs strukturiert
- **Artikel-Editor**: Markdown-basierter Editor mit Live-Preview
- **Versionierung**: Automatisches Tracking von Artikelversionen
- **Status-Workflow**: Draft → Review → Approved → Published

### 🤖 KI-Integration
- **NeuronWriter API**: Automatische NLP-Keyword-Analyse und Content-Optimierung
- **Claude Opus 4.5**: KI-gestütztes Content-Design und HTML-Generierung
- **Outline & FAQ Generator**: Automatische Strukturierung von SEO-Content
- **Mehrsprachige Übersetzung**: AI-powered Translation für internationale Märkte

### 🎨 Design & Export
- **Elementor JSON Generator**: Erstellt WordPress Elementor Templates aus Markdown
- **HTML Export mit Tailwind**: Responsive Landing Pages mit modernem Design
- **NetCo Body-Cam Branding**: Konsistente Corporate-Identity (#003366, #ff6600)
- **ACF Integration**: Direkte Speicherung in WordPress Custom Fields

### 🔗 WordPress Automation
- **Headless WordPress Publishing**: Automatische Veröffentlichung via REST API
- **Internal Linking**: KI-gesteuerte Verlinkung zwischen verwandten Artikeln
- **Batch Publishing**: Mehrere Artikel auf einmal veröffentlichen
- **Polylang/WPML Support**: Mehrsprachige Content-Verwaltung

---

## 🏗️ Architektur

```
seo-ops-magic/
├── src/                          # React Frontend (Lovable)
│   ├── components/               # UI Components
│   ├── pages/                    # Page Routes
│   ├── lib/                      # Business Logic
│   └── integrations/             # Supabase & APIs
├── automation/                   # Node.js Backend (WordPress Automation)
│   ├── src/
│   │   ├── services/             # WordPress, LLM, Supabase Services
│   │   ├── modules/              # Publishing & Linking Logic
│   │   └── scripts/              # CLI Tools
│   ├── DEPLOY.md                 # Deployment Guide
│   └── LOVABLE_DEPLOY.md         # Lovable-specific Guide
├── supabase/
│   ├── functions/                # Edge Functions
│   └── migrations/               # Database Schema
└── .github/workflows/            # GitHub Actions
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Supabase (Database & Auth)
- React Router

**Backend/Automation:**
- Node.js 20 + TypeScript
- WordPress REST API
- Anthropic Claude Opus 4.5
- NeuronWriter API
- Supabase SDK

**Infrastructure:**
- Lovable (Frontend Hosting)
- Supabase (Database & Edge Functions)
- GitHub Actions (Automation)
- WordPress (Headless CMS)

---

## 🚀 Quick Start

### Frontend (Lovable App)

#### 1. Clone Repository
```bash
git clone https://github.com/strategiert/seo-ops-magic.git
cd seo-ops-magic
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

#### 4. Start Development Server
```bash
npm run dev
```

Frontend läuft auf `http://localhost:5173`

### WordPress Automation

#### 1. Setup
```bash
cd automation
npm install
cp .env.example .env
# Edit .env with WordPress & API credentials
```

#### 2. Build
```bash
npm run build
```

#### 3. Publish Article
```bash
npm run publish-article -- --article-id <uuid>
```

**Ausführliche Setup-Anleitungen:**
- [`automation/README.md`](automation/README.md) - Technische Dokumentation
- [`automation/DEPLOY.md`](automation/DEPLOY.md) - Deployment-Optionen
- [`automation/LOVABLE_DEPLOY.md`](automation/LOVABLE_DEPLOY.md) - Lovable-spezifisch

---

## 📚 Dokumentation

### Setup Guides
- **[Frontend Setup](automation/LOVABLE_DEPLOY.md#setup-optionen)** - React App Installation
- **[WordPress Setup](automation/DEPLOY.md#wordpress-setup)** - WordPress & ACF Konfiguration
- **[GitHub Actions](automation/DEPLOY.md#option-4-github-actions-automatisiert)** - Automatisiertes Publishing

### Deployment
- **[Local Development](automation/LOVABLE_DEPLOY.md#option-a-lokale-nutzung-empfohlen)** - Lokale Nutzung
- **[Server Deployment](automation/DEPLOY.md#option-2-server-deployment-für-regelmäßiges-publishing)** - VPS mit Cron
- **[Docker](automation/DEPLOY.md#option-3-docker-deployment)** - Containerized
- **[GitHub Actions](automation/DEPLOY.md#option-4-github-actions-automatisiert)** - CI/CD (empfohlen)

### APIs & Integration
- **[NeuronWriter Integration](src/lib/api/neuronwriter.ts)** - NLP Keyword Analysis
- **[WordPress Service](automation/src/services/WordPressService.ts)** - REST API Client
- **[LLM Service](automation/src/services/LLMService.ts)** - AI Design Wrapper

---

## 🎯 Workflows

### Content-Erstellung Workflow
```
1. Projekt erstellen
   ↓
2. Content Brief definieren
   ↓
3. NeuronWriter Guidelines generieren
   ↓
4. Artikel schreiben (Markdown)
   ↓
5. Elementor Template / HTML Export
   ↓
6. WordPress Publishing (automatisch)
```

### WordPress Publishing Workflow
```
1. Artikel auf "Approved" setzen
   ↓
2. Automation Script ausführen
   ↓
3. AI generiert Tailwind HTML
   ↓
4. Internal Linker fügt Cross-Links ein
   ↓
5. WordPress Post erstellen
   ↓
6. HTML in custom_html_content speichern
   ↓
7. Post-ID zurück in Supabase
```

---

## 🔧 Konfiguration

### WordPress Setup

#### 1. Plugins installieren
- **Advanced Custom Fields Pro** (erforderlich)
- **Polylang** oder **WPML** (optional, für Mehrsprachigkeit)

#### 2. ACF Field erstellen
```
Field Label: Custom HTML Content
Field Name: custom_html_content
Field Type: Textarea
Location: Post Type = Post
```

#### 3. Application Password
1. WP Admin → Users → Profile
2. Application Passwords → "SEO Ops Automation"
3. Passwort kopieren → in `.env` einfügen

### Supabase Setup

#### 1. Database Migration
```bash
# In Supabase SQL Editor
-- automation/src/services/SupabaseService.ts benötigt wp_post_id Column
ALTER TABLE articles ADD COLUMN wp_post_id INTEGER;
```

#### 2. Environment Variables
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### API Keys

```env
# WordPress
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=admin
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# NeuronWriter (optional)
NEURONWRITER_API_KEY=your-key
```

---

## 🤝 Contributing

Contributions sind willkommen!

### Development Setup
```bash
# Frontend
npm install
npm run dev

# Backend
cd automation
npm install
npm run watch  # TypeScript watch mode
```

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Conventional Commits

### Pull Requests
1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Pull Request öffnen

---

## 📊 Datenbank Schema

### Haupttabellen
- **projects** - SEO Projekte
- **content_briefs** - Content-Briefings mit NeuronWriter Guidelines
- **articles** - Artikel mit Markdown, HTML, Meta-Daten
- **html_exports** - Generierte HTML Landing Pages
- **elementor_templates** - Elementor JSON Templates

### Relationen
```
projects 1:N content_briefs 1:N articles
articles 1:N html_exports
articles 1:N elementor_templates
```

---

## 🔒 Sicherheit

- **Environment Variables**: Niemals committen (`.gitignore`)
- **Service Role Keys**: Regelmäßig rotieren (alle 90 Tage)
- **WordPress App Passwords**: Pro Service separate Passwords
- **HTTPS Only**: Alle API-Calls verschlüsselt
- **Row Level Security**: Supabase RLS aktiviert

---

## 📈 Roadmap

- [ ] Multi-Tenant Support (mehrere Kunden)
- [ ] Content-Kalender & Planung
- [ ] Analytics Dashboard (Rankings, Traffic)
- [ ] Bulk Import (CSV/Excel)
- [ ] Keyword Research Tool
- [ ] Competitor Analysis
- [ ] A/B Testing für Headlines
- [ ] SEO Score & Optimierungsvorschläge

---

## 🐛 Troubleshooting

### Frontend startet nicht
```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```

### WordPress Publishing Error
```bash
# Application Password prüfen
# 1. Neues Password in WordPress generieren
# 2. automation/.env aktualisieren
```

### Supabase Connection Error
```bash
# Service Role Key prüfen
# Supabase Dashboard → Settings → API → service_role
```

Weitere Hilfe: [automation/DEPLOY.md#troubleshooting](automation/DEPLOY.md#troubleshooting)

---

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details

---

## 🙏 Credits

**Entwickelt mit:**
- [Lovable](https://lovable.dev) - AI-powered Development
- [Supabase](https://supabase.com) - Backend as a Service
- [Anthropic Claude](https://anthropic.com) - AI Content Generation
- [shadcn/ui](https://ui.shadcn.com) - UI Components
- [NeuronWriter](https://neuronwriter.com) - SEO Content Optimization

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/strategiert/seo-ops-magic/issues)
- **Dokumentation**: [`automation/README.md`](automation/README.md)
- **Deployment**: [`automation/DEPLOY.md`](automation/DEPLOY.md)

---

**Made with ❤️ for SEO Teams**
