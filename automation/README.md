# SEO Ops Magic - WordPress Automation

Automated publishing system for SEO Ops Magic articles to Headless WordPress with ACF integration, internal linking, and multilingual support.

## Features

- **WordPress Publishing**: Automated article publishing via WordPress REST API
- **Beautiful Design**: AI-powered HTML generation with Tailwind CSS
- **ACF Integration**: Stores HTML content in `custom_html_content` ACF field
- **Internal Linking**: Automatic cross-linking between related articles
- **Multilingual Support**: Translation and language management (Polylang/WPML ready)
- **Batch Publishing**: Publish multiple articles at once

## Architecture

```
automation/
├── src/
│   ├── services/          # Core services
│   │   ├── WordPressService.ts    # WordPress REST API client
│   │   ├── LLMService.ts          # AI design wrapper & translation
│   │   └── SupabaseService.ts     # Supabase database client
│   ├── modules/           # Business logic modules
│   │   ├── WordPressPublisher.ts  # Main publishing logic
│   │   └── InternalLinker.ts      # Internal link detection
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utilities (config loader)
│   └── scripts/           # Executable scripts
│       └── publishArticle.ts
├── config/                # Configuration files
├── package.json
├── tsconfig.json
└── .env
```

## Setup

### 1. Install Dependencies

```bash
cd automation
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# WordPress
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM (choose one)
ANTHROPIC_API_KEY=your-anthropic-key
# OR
OPENAI_API_KEY=your-openai-key
```

### 3. WordPress Setup

#### Create Application Password

1. Go to WordPress Admin → Users → Profile
2. Scroll down to "Application Passwords"
3. Enter name: "SEO Ops Automation"
4. Click "Add New Application Password"
5. Copy the generated password to `.env`

#### Install Required Plugins

- **Advanced Custom Fields (ACF) Pro**: For `custom_html_content` field
- **Polylang** or **WPML** (optional): For multilingual support

#### Create ACF Field

1. ACF → Field Groups → Add New
2. Title: "Article Custom HTML"
3. Add Field:
   - Field Label: "Custom HTML Content"
   - Field Name: `custom_html_content`
   - Field Type: Textarea
4. Location: Post Type = Post
5. Publish

### 4. Database Migration

Add `wp_post_id` column to articles table:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE articles ADD COLUMN wp_post_id INTEGER;
CREATE INDEX IF NOT EXISTS articles_wp_post_id_idx ON articles(wp_post_id);
```

## Usage

### Publish a Single Article

```bash
npm run publish-article -- --article-id <uuid>
```

### Publish All Approved Articles for a Project

```bash
npm run publish-article -- --project-id <uuid>
```

### Publish All Approved Articles

```bash
npm run publish-article
```

### Options

- `--article-id <uuid>`: Publish specific article
- `--project-id <uuid>`: Publish all approved articles in project
- `--status <status>`: Set WordPress post status (publish, draft, pending)
- `--no-links`: Disable internal linking
- `--language <lang>`: Set language (de, en, fr, etc.)

### Examples

```bash
# Publish as draft for review
npm run publish-article -- --article-id abc123 --status draft

# Publish directly to WordPress
npm run publish-article -- --article-id abc123 --status publish

# Publish without internal links
npm run publish-article -- --article-id abc123 --no-links

# Publish in English
npm run publish-article -- --article-id abc123 --language en
```

## Programmatic Usage

```typescript
import {
  loadConfig,
  WordPressService,
  LLMService,
  SupabaseService,
  InternalLinker,
  WordPressPublisher
} from './src/index';

async function publishArticle() {
  const config = loadConfig();

  // Initialize services
  const wpService = new WordPressService(
    config.wordpress.url,
    config.wordpress.username,
    config.wordpress.appPassword
  );

  const llmService = new LLMService(
    config.llm.provider,
    config.llm.apiKey
  );

  const supabaseService = new SupabaseService(
    config.supabase.url,
    config.supabase.serviceRoleKey
  );

  // Set up internal linker
  const internalLinker = new InternalLinker();
  const linkableArticles = await supabaseService.getAllPublishedArticles();
  internalLinker.loadArticles(linkableArticles);

  // Create publisher
  const publisher = new WordPressPublisher(
    wpService,
    llmService,
    internalLinker
  );

  // Publish
  const article = await supabaseService.getArticle('article-uuid');
  const postId = await publisher.publishArticle(article, {
    status: 'publish',
    addInternalLinks: true,
    maxInternalLinks: 5,
    language: 'de',
  });

  console.log(`Published to WordPress! Post ID: ${postId}`);
}
```

## How It Works

### Publishing Flow

1. **Fetch Article**: Retrieve article data from Supabase
2. **Generate HTML**: Use LLM to convert Markdown → Tailwind HTML
3. **Add Internal Links**: Detect keywords and insert cross-links
4. **Create WordPress Post**: Publish via REST API
5. **Store in ACF**: Save HTML in `custom_html_content` field
6. **Update Supabase**: Store WordPress post ID back in database

### Design Wrapper

The LLM service transforms markdown content into beautiful, responsive HTML:

- **Tailwind CSS**: Modern utility-first styling
- **Brand Consistency**: NetCo Body-Cam colors and fonts
- **Responsive**: Mobile-first design
- **SEO Optimized**: Proper heading hierarchy
- **FAQ Accordion**: Interactive `<details>` elements
- **CTA Sections**: Conversion-optimized calls-to-action

### Internal Linking

The Internal Linker automatically detects keywords and creates cross-links:

- Finds keyword matches in content
- Filters by language
- Avoids self-linking
- Limits to max links per article
- Inserts semantic HTML links with proper attributes

### Multilingual

Translation workflow:

1. Publish master content in German
2. Use LLM to translate to target language
3. Create translated post in WordPress
4. Link translations via Polylang API
5. Adjust internal links for each language

## Troubleshooting

### Authentication Errors

- Verify WordPress Application Password is correct
- Check username matches WordPress user
- Ensure REST API is enabled (`/wp-json/wp/v2/posts`)

### ACF Field Not Saving

- Install ACF Pro
- Create `custom_html_content` field
- Ensure field is assigned to Posts

### LLM Errors

- Check API key is valid
- Verify sufficient API credits
- Try switching between Anthropic/OpenAI

### Internal Links Not Working

- Ensure articles have `primary_keyword` set
- Check articles have status `published`
- Verify language matches

## Development

Build TypeScript:

```bash
npm run build
```

Run in development mode:

```bash
npm run dev
```

## License

MIT
