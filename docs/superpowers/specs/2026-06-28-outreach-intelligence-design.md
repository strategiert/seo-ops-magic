# Outreach Intelligence Design

## Goal

Make Outreach feel like an AI-first operating system instead of a CRM form. The user should be able to click one primary action, have the agent understand the project from existing Notamsign/Netco dashboard data, inspect the sitemap and available content, then recommend linkbait-ready content opportunities and create an outreach campaign from the best fit.

## User Experience

The Outreach list page becomes an AI workbench:

- Primary CTA: `KI analysieren`.
- Secondary CTA: `Kampagne manuell erstellen`.
- The page shows the latest intelligence run with status, source coverage, and recommended opportunities.
- Empty state explains that the AI will inspect Brand Profile, crawl pages, articles, briefs, HTML exports, content assets, GSC connection metadata, dashboard pages, and sitemap URLs.
- The campaign table remains below the AI panel, but it is no longer the main entry point.

The campaign creation form remains for fallback/manual use, but the normal flow is:

1. User clicks `KI analysieren`.
2. Agent gathers project context and sitemap URLs.
3. Agent scores content pieces by linkbait potential.
4. Agent saves an `outreachAnalysis`.
5. Agent creates one recommended draft/ready campaign for the top opportunity, with strategy JSON and target article IDs when applicable.
6. User opens the generated campaign and can edit Prospects/Sequence/Goals if needed.

## Data Sources

The analysis context uses existing Convex data first:

- `projects`: domain, WordPress URL, default language, audience, tonality.
- `brandProfiles`: identity, products/services, personas, competitors, keywords, content gaps, crawl configuration, discovered URLs.
- `brandCrawlData`: top relevant crawled pages with title, URL, markdown, page type, headings, links, meta descriptions.
- `articles`: title, keyword, status, markdown/html excerpts, meta fields, FAQ/outline.
- `contentBriefs`: title, keyword, search intent, NeuronWriter guidelines, research packs, priority.
- `htmlExports`: standalone landing page candidates.
- `contentAssets`: previously created social/PR/newsletter/linkbait assets.
- `gscConnections`: property metadata and whether Search Console is connected.
- `bodycamPages`: dashboard-managed website content snapshots, summarized from JSON text.

The agent also fetches live sitemap data from the project domain:

- `/robots.txt` for sitemap declarations.
- `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml` fallback URLs.
- First 80 URLs from discovered sitemaps, normalized and categorized by path.

The MVP does not crawl every live page body. It uses existing crawl data for page content and sitemap data for coverage gaps. Full live page crawling can be a later worker.

## AI Output

The agent returns structured JSON:

```json
{
  "summary": "Kurzfazit",
  "sourceCoverage": {
    "brandProfile": true,
    "crawlPages": 24,
    "articles": 12,
    "briefs": 7,
    "htmlExports": 3,
    "contentAssets": 18,
    "sitemapUrls": 80,
    "gscConnected": true,
    "dashboardPages": 14
  },
  "opportunities": [
    {
      "title": "Linkbait-Opportunity",
      "contentType": "blog|whitepaper|tool|study|template|landing_page|data_asset|other",
      "sourceKind": "article|crawl_page|brief|html_export|content_asset|sitemap_url|new_asset",
      "sourceId": "optional Convex id or URL",
      "sourceUrl": "optional URL",
      "targetArticleId": "optional article id",
      "score": 0.87,
      "effort": "low|medium|high",
      "linkabilityReasons": ["reason"],
      "audiences": ["audience"],
      "recommendedAssetUpgrade": "Was aus dem Content gemacht werden sollte",
      "outreachAngles": ["angle"],
      "searchOperators": ["operator"],
      "campaignName": "Generated campaign name"
    }
  ],
  "recommendedCampaign": {
    "name": "Campaign name",
    "targetDomain": "notamsign.com",
    "goals": "Konkretes Kampagnenziel",
    "strategy": {
      "summary": "Strategy",
      "positioning": "Pitch position",
      "recommendedMethods": ["resource_page", "digital_pr"],
      "searchOperators": ["..."],
      "risks": ["..."],
      "nextActions": ["..."]
    }
  }
}
```

## Persistence

Add `outreachAnalyses`:

- `projectId`
- `status`: `running | completed | failed`
- `summary`
- `sourceCoverageJson`
- `opportunitiesJson`
- `recommendedCampaignJson`
- `createdCampaignId`
- `errorMessage`
- `createdAt`, `updatedAt`

The analysis is project-scoped and owner-authorized. The newest run is shown on the Outreach page.

## Agent Flow

Add `outreach-intelligence` as an Inngest function:

1. Reserve credits.
2. Create an agent job record.
3. Create an `outreachAnalyses` row with `running`.
4. Fetch project context from Convex through secured actions.
5. Fetch sitemap data from the project domain.
6. Ask Claude to score linkbait opportunities and recommend a campaign.
7. Save analysis output.
8. Create or update one generated outreach campaign for the recommended opportunity.
9. Complete usage/job logs.

## Error Handling

- If the sitemap cannot be fetched, continue with stored crawl and dashboard data.
- If no articles exist, still score crawl pages, sitemap URLs, briefs, and new asset ideas.
- If Claude returns invalid JSON, save a failed analysis with a clear message.
- If campaign creation fails, keep the analysis result and show the error in the UI.

## Not In This Slice

- Contact discovery.
- Email sending.
- Inbox sync.
- Warm-up.
- Automated SERP scraping beyond search operators.
- Full live page crawling beyond sitemap discovery.
