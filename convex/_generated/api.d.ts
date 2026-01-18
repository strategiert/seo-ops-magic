/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_articleGeneration from "../actions/articleGeneration.js";
import type * as actions_firecrawl from "../actions/firecrawl.js";
import type * as actions_gemini from "../actions/gemini.js";
import type * as actions_htmlExport from "../actions/htmlExport.js";
import type * as actions_neuronwriter from "../actions/neuronwriter.js";
import type * as actions_wordpress from "../actions/wordpress.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as tables_articleDesignRecipes from "../tables/articleDesignRecipes.js";
import type * as tables_articles from "../tables/articles.js";
import type * as tables_brandCrawlData from "../tables/brandCrawlData.js";
import type * as tables_brandProfiles from "../tables/brandProfiles.js";
import type * as tables_contentBriefs from "../tables/contentBriefs.js";
import type * as tables_htmlExports from "../tables/htmlExports.js";
import type * as tables_integrations from "../tables/integrations.js";
import type * as tables_profiles from "../tables/profiles.js";
import type * as tables_projects from "../tables/projects.js";
import type * as tables_workspaces from "../tables/workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/articleGeneration": typeof actions_articleGeneration;
  "actions/firecrawl": typeof actions_firecrawl;
  "actions/gemini": typeof actions_gemini;
  "actions/htmlExport": typeof actions_htmlExport;
  "actions/neuronwriter": typeof actions_neuronwriter;
  "actions/wordpress": typeof actions_wordpress;
  auth: typeof auth;
  http: typeof http;
  "tables/articleDesignRecipes": typeof tables_articleDesignRecipes;
  "tables/articles": typeof tables_articles;
  "tables/brandCrawlData": typeof tables_brandCrawlData;
  "tables/brandProfiles": typeof tables_brandProfiles;
  "tables/contentBriefs": typeof tables_contentBriefs;
  "tables/htmlExports": typeof tables_htmlExports;
  "tables/integrations": typeof tables_integrations;
  "tables/profiles": typeof tables_profiles;
  "tables/projects": typeof tables_projects;
  "tables/workspaces": typeof tables_workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
