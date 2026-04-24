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
import type * as actions_bodycam from "../actions/bodycam.js";
import type * as actions_bodycamAI from "../actions/bodycamAI.js";
import type * as actions_gemini from "../actions/gemini.js";
import type * as actions_googleAuth from "../actions/googleAuth.js";
import type * as actions_gsc from "../actions/gsc.js";
import type * as actions_htmlExport from "../actions/htmlExport.js";
import type * as actions_jina from "../actions/jina.js";
import type * as actions_neuronwriter from "../actions/neuronwriter.js";
import type * as actions_openai from "../actions/openai.js";
import type * as actions_wordpress from "../actions/wordpress.js";
import type * as agents_actions from "../agents/actions.js";
import type * as agents_internal from "../agents/internal.js";
import type * as agents_routerTriggers from "../agents/routerTriggers.js";
import type * as agents_triggers from "../agents/triggers.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as tables_articleDesignRecipes from "../tables/articleDesignRecipes.js";
import type * as tables_articles from "../tables/articles.js";
import type * as tables_bodycam from "../tables/bodycam.js";
import type * as tables_brandCrawlData from "../tables/brandCrawlData.js";
import type * as tables_brandProfiles from "../tables/brandProfiles.js";
import type * as tables_brandVectorDocuments from "../tables/brandVectorDocuments.js";
import type * as tables_contentBriefs from "../tables/contentBriefs.js";
import type * as tables_credits from "../tables/credits.js";
import type * as tables_elementorTemplates from "../tables/elementorTemplates.js";
import type * as tables_googleAccounts from "../tables/googleAccounts.js";
import type * as tables_gscConnections from "../tables/gscConnections.js";
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
  "actions/bodycam": typeof actions_bodycam;
  "actions/bodycamAI": typeof actions_bodycamAI;
  "actions/gemini": typeof actions_gemini;
  "actions/googleAuth": typeof actions_googleAuth;
  "actions/gsc": typeof actions_gsc;
  "actions/htmlExport": typeof actions_htmlExport;
  "actions/jina": typeof actions_jina;
  "actions/neuronwriter": typeof actions_neuronwriter;
  "actions/openai": typeof actions_openai;
  "actions/wordpress": typeof actions_wordpress;
  "agents/actions": typeof agents_actions;
  "agents/internal": typeof agents_internal;
  "agents/routerTriggers": typeof agents_routerTriggers;
  "agents/triggers": typeof agents_triggers;
  auth: typeof auth;
  http: typeof http;
  "tables/articleDesignRecipes": typeof tables_articleDesignRecipes;
  "tables/articles": typeof tables_articles;
  "tables/bodycam": typeof tables_bodycam;
  "tables/brandCrawlData": typeof tables_brandCrawlData;
  "tables/brandProfiles": typeof tables_brandProfiles;
  "tables/brandVectorDocuments": typeof tables_brandVectorDocuments;
  "tables/contentBriefs": typeof tables_contentBriefs;
  "tables/credits": typeof tables_credits;
  "tables/elementorTemplates": typeof tables_elementorTemplates;
  "tables/googleAccounts": typeof tables_googleAccounts;
  "tables/gscConnections": typeof tables_gscConnections;
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
