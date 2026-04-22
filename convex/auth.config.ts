/**
 * Convex Auth Configuration
 *
 * Uses Clerk's recommended env-var setup so Dev/Prod can be switched by
 * updating CLERK_FRONTEND_API_URL in the Convex dashboard (no code change).
 *
 * - Production: https://clerk.notamsign.com
 * - Dev sandbox: https://heroic-stinkbug-5.clerk.accounts.dev
 */

const frontendApiUrl =
  process.env.CLERK_FRONTEND_API_URL ?? "https://clerk.notamsign.com";

export default {
  providers: [
    {
      domain: frontendApiUrl,
      applicationID: "convex",
    },
  ],
};
