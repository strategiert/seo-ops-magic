# SEO Ops Magic - Marketing Automation Platform

## Project Overview

SEO Ops Magic ist eine KI-gestützte Marketing-Automatisierungsplattform für mittelständische Unternehmen. Die Plattform automatisiert den gesamten Content-Workflow von der Erstellung bis zur Multi-Channel-Distribution.

### Vision: Content-zu-Kampagne Pipeline

Ein Pillar-Content (SEO-Artikel) wird automatisch transformiert in:
- Pressemeldungen
- Social Media Posts (Company & Employee Advocacy)
- Paid Ads (Google, Meta, LinkedIn, TikTok, Pinterest)
- Newsletter
- Linkbaits für Outreach

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **UI:** shadcn/ui + Radix UI + Tailwind CSS
- **Auth:** Clerk
- **Routing:** React Router DOM

### Backend
- **Automation:** Node.js + TypeScript (automation/)
- **Database:** Convex (reactive database)
- **Hosting:** Vercel
- **Auth:** Clerk
- **LLM:** Claude Agent SDK + Anthropic API

### External Services
- **CMS:** WordPress (Headless via REST API)
- **SEO:** NeuronWriter API

## Directory Structure

```
seo-ops-magic/
├── src/                      # React Frontend
│   ├── components/           # UI Components
│   ├── pages/               # Route Pages
│   ├── lib/                 # Business Logic
│   └── integrations/        # API Clients
├── automation/              # Node.js Backend
│   ├── src/
│   │   ├── services/        # WordPress, LLM, Supabase
│   │   ├── modules/         # Publisher, Linker
│   │   └── scripts/         # CLI Tools
├── supabase/               # Edge Functions
│   └── functions/
├── .claude/                # Agent Skills
│   └── skills/
└── convex/                 # Database Schema
```

## Brand Guidelines

### Colors
- **Primary:** #003366 (Dark Blue)
- **Accent:** #ff6600 (Orange)
- **Background:** #ffffff
- **Text:** #333333

### Voice & Tone
- Professionell aber zugänglich
- Expertise zeigen ohne überheblich zu wirken
- Konkret und handlungsorientiert
- Deutsche Sprache als Standard (außer für internationale Kampagnen)

## Database Schema (Convex Tables)

### articles
- _id, projectId, title, content (Markdown), status
- seoKeywords, metaDescription, featuredImageUrl
- wordpressPostId, publishedAt

### contentAssets
- _id, articleId, assetType (press_release, social_post, ad_copy, newsletter)
- platform (linkedin, instagram, facebook, etc.)
- accountType (company, employee)
- content, metadata, status

### visualAssets
- _id, contentAssetId, assetType (image, video, carousel)
- platform, dimensions, aiPrompt, fileUrl, status

### outreachCampaigns
- _id, articleId, campaignType (press, linkbuilding, seeding)
- status

### outreachContacts
- _id, campaignId, name, outlet, email, beat
- relevanceScore, status, lastContactedAt

## Content Workflow

1. **Brief erstellen** → NeuronWriter Keywords + Guidelines
2. **Artikel schreiben** → SEO-optimierter Pillar Content
3. **Internal Linking** → Semantische Verlinkung
4. **HTML Design** → Tailwind-styled Landing Page
5. **WordPress Publish** → REST API + ACF Fields
6. **Repurposing** → Transform zu allen Kanälen
7. **Asset Generation** → Bilder, Videos, Carousels
8. **Distribution** → Social, Ads, Newsletter, Outreach

## API Credentials (via .env)

```
ANTHROPIC_API_KEY=          # Claude API
CONVEX_DEPLOYMENT=          # Convex Project
CLERK_PUBLISHABLE_KEY=      # Clerk Auth
CLERK_SECRET_KEY=           # Clerk Auth
WORDPRESS_URL=              # CMS
WORDPRESS_USERNAME=         # WP Auth
WORDPRESS_APP_PASSWORD=     # WP Auth
NEURONWRITER_API_KEY=       # SEO Tool
```

## Conventions

### Code Style
- TypeScript strict mode
- Async/await für alle API calls
- Error handling mit try/catch
- Logging mit console.log (später: structured logging)

### Naming
- Files: kebab-case (my-component.ts)
- Components: PascalCase (MyComponent)
- Functions: camelCase (myFunction)
- Constants: UPPER_SNAKE_CASE

### Git
- Conventional Commits: feat:, fix:, chore:, docs:
- Feature branches: feature/skill-name
- PR before merge to main

## Skills Overview

### Implemented Skills ✅

#### Content Transformation (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `social-post-creator` | Multi-Plattform Social Media Posts | SKILL.md, PLATFORM_SPECS.md, TONE_GUIDELINES.md, HASHTAG_STRATEGIES.md, CTA_LIBRARY.md, templates/ |
| `ad-copy-writer` | Werbetexte für alle Plattformen | SKILL.md, PLATFORM_REQUIREMENTS.md, COPYWRITING_FORMULAS.md, AUDIENCE_PERSONAS.md, COMPLIANCE_RULES.md, CTA_LIBRARY.md, templates/ |
| `press-release-writer` | Pressemeldungen nach AP Style | SKILL.md, AP_STYLE_GUIDE.md, QUOTE_GUIDELINES.md, PRESS_RELEASE_TYPES.md, BOILERPLATE_TEMPLATES.md, templates/ |
| `newsletter-composer` | Email-Newsletter | SKILL.md, SUBJECT_LINE_FORMULAS.md, EMAIL_STRUCTURE.md, SPAM_TRIGGER_WORDS.md, templates/ |
| `linkbait-creator` | Virale Inhalte für Linkbuilding | SKILL.md, LINKBAIT_TYPES.md, PROMOTION_PLAYBOOK.md, templates/ |
| `content-translator` | DE↔EN Übersetzungen mit SEO | SKILL.md, CULTURAL_ADAPTATIONS.md, CTA_TRANSLATIONS.md, TECHNICAL_GLOSSARY.md |

#### SEO & Linking (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `internal-linker` | Semantische interne Verlinkung | SKILL.md, SEMANTIC_ANALYSIS.md, ANCHOR_TEXT_STRATEGIES.md, STRATEGIES.md, scripts/analyze_links.py |

#### Outreach (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `press-outreach-bot` | Journalisten-Recherche & PR Outreach | SKILL.md, RESEARCH_METHODS.md, PITCH_TEMPLATES.md, FOLLOW_UP_TEMPLATES.md, templates/ |
| `link-building-agent` | Strategischer Backlink-Aufbau | SKILL.md, LINK_BUILDING_METHODS.md, COMPETITOR_ANALYSIS.md, OUTREACH_TEMPLATES.md |
| `editorial-researcher` | Journalisten-Datenbank aufbauen | SKILL.md |

#### Content Creation (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `seo-content-writer` | SEO-optimierte Pillar-Artikel | SKILL.md, CONTENT_TYPES.md, CONTENT_STRUCTURE.md, TOPIC_CLUSTERS.md |
| `html-designer` | Markdown → HTML mit Tailwind | SKILL.md, TYPOGRAPHY.md, COMPONENTS.md, PAGE_LAYOUTS.md |
| `wordpress-publisher` | WP Publishing via REST API | SKILL.md, API_REFERENCE.md |

#### Visual Assets (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `image-generator` | AI-generierte Bilder | SKILL.md, PLATFORM_IMAGE_SPECS.md, AI_PROMPT_PATTERNS.md, BRAND_VISUAL_GUIDELINES.md |
| `video-creator` | Video Scripts & Storyboards | SKILL.md, VIDEO_FORMATS.md |
| `carousel-designer` | Multi-Slide Carousels | SKILL.md |

#### Social Management (implemented)
| Skill | Description | Files |
|-------|-------------|-------|
| `company-social-manager` | Firmenaccount-Strategie | SKILL.md, PLATFORM_STRATEGY.md |
| `employee-advocacy-manager` | Mitarbeiter-Content | SKILL.md |

### Planned Skills (not yet implemented)

#### Platform-Specific Ads (optional, ad-copy-writer covers basics)
- `google-ads-creator` - Google Search/Display Ads
- `meta-ads-creator` - Facebook/Instagram Ads
- `linkedin-ads-creator` - LinkedIn Sponsored Content
- `tiktok-ads-creator` - TikTok Ads
- `pinterest-ads-creator` - Pinterest Pins

## Token-Optimierung

Siehe: [.claude/AGENT_ARCHITECTURE.md](.claude/AGENT_ARCHITECTURE.md)

### Kernprinzipien
1. **Lazy Loading** - Skills nur bei Bedarf laden, nicht alle auf einmal
2. **Referenzen statt Daten** - Artikel-IDs übergeben, nicht 5000 Wörter
3. **Convex-Storage** - Outputs in DB speichern, nicht im Context
4. **Chunking** - Große Artikel in Sections aufteilen
5. **Summaries** - Router sieht nur Zusammenfassungen

### Skill Registry
- `.claude/skills/REGISTRY.json` - Alle Skills mit Summary und Token-Schätzung
- Router lädt nur Summaries (~500 Tokens)
- Spezialist lädt nur seinen SKILL.md (~2000-4000 Tokens)
- Supporting Docs nur bei spezifischen Fragen

### Workflow-Pattern
```
User → Router (sieht: articleId, title, keywords)
          ↓
     Social Agent (lädt: social-post-creator/SKILL.md)
          ↓
     Convex (speichert: generierte Posts)
          ↓
User ← Result (IDs, nicht Content)
```

## Important Notes

- Alle Content-Generierung in deutscher Sprache (Standard)
- Bei Übersetzungen: Fachterminologie aus Glossar verwenden
- WordPress ACF Fields für HTML-Content nutzen
- Bilder immer mit Alt-Text für SEO
- Social Posts: Company vs. Personal Voice unterscheiden
- Ads: Platform-spezifische Limits beachten
- **Token-Limit beachten**: Große Daten in Convex, nicht im Context
