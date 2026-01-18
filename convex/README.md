# Convex Backend - Migrated from Supabase

This directory contains the Convex backend implementation, migrated from Supabase.

## Setup

### 1. Initialize Convex

```bash
npx convex dev
```

This will prompt you to:
- Log in to Convex
- Create a new project or select an existing one
- Generate the `_generated` folder

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Convex
VITE_CONVEX_URL=https://your-project.convex.cloud

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# External APIs (set in Convex Dashboard > Settings > Environment Variables)
# GEMINI_API_KEY=...
# FIRECRAWL_API_KEY=...
# NEURONWRITER_API_KEY=...
```

### 3. Set Convex Environment Variables

In the Convex Dashboard, go to Settings > Environment Variables and add:

- `GEMINI_API_KEY` - Google Gemini API key
- `FIRECRAWL_API_KEY` - Firecrawl API key
- `NEURONWRITER_API_KEY` - NeuronWriter API key

### 4. Configure Webhooks

#### Clerk Webhook
1. Go to Clerk Dashboard > Webhooks
2. Add endpoint: `https://your-project.convex.site/clerk-webhook`
3. Select event: `user.created`

#### Firecrawl Webhook
Set `CONVEX_SITE_URL` environment variable in Convex:
```
CONVEX_SITE_URL=https://your-project.convex.site
```

## Directory Structure

```
convex/
├── schema.ts           # Database schema (18 tables)
├── auth.ts             # Authentication utilities
├── http.ts             # HTTP routes for webhooks
│
├── tables/             # Database queries and mutations
│   ├── workspaces.ts
│   ├── projects.ts
│   ├── profiles.ts
│   ├── articles.ts
│   ├── contentBriefs.ts
│   ├── integrations.ts
│   ├── brandProfiles.ts
│   ├── brandCrawlData.ts
│   ├── articleDesignRecipes.ts
│   └── htmlExports.ts
│
└── actions/            # Server actions (external API calls)
    ├── wordpress.ts    # WordPress publishing
    ├── neuronwriter.ts # NeuronWriter SEO API
    ├── firecrawl.ts    # Website crawling
    ├── gemini.ts       # Google Gemini AI
    ├── htmlExport.ts   # HTML generation
    └── articleGeneration.ts  # Article generation
```

## Migration from Supabase

### What Changed

| Supabase | Convex |
|----------|--------|
| SQL schema | TypeScript schema (`schema.ts`) |
| Edge Functions (Deno) | Actions (Node.js) |
| Supabase Auth | Clerk Authentication |
| RLS Policies | Auth checks in functions |
| Realtime subscriptions | Built-in with `useQuery` |
| `supabase.from().select()` | `ctx.db.query()` |

### Frontend Hooks

New Convex-based hooks (use these instead of the old ones):

| Old Hook | New Hook |
|----------|----------|
| `useWorkspace` | `useWorkspaceConvex` |
| `useBrandProfile` | `useBrandProfileConvex` |
| `useWordPress` | `useWordPressConvex` |
| N/A | `useArticlesConvex` |

### Key Benefits

1. **No Polling**: Real-time updates are automatic with `useQuery`
2. **Type Safety**: Full TypeScript from schema to frontend
3. **Simpler Auth**: Clerk handles all auth complexity
4. **Better DX**: Hot reload, better error messages

## Running Locally

```bash
# Start Convex dev server
npx convex dev

# In another terminal, start Vite
npm run dev
```

## Deployment

```bash
# Deploy to production
npx convex deploy
```

## Data Migration

See the `scripts/` folder for data migration scripts (to be created).

Migration order:
1. profiles → workspaces (Tier 1)
2. projects (Tier 2)
3. integrations (Tier 3)
4. content_briefs (Tier 4)
5. articles + related (Tier 5)
6. brand_profiles + related (Tier 6)
7. utility tables (Tier 7)
