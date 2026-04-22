/**
 * Convex Auth Configuration
 *
 * Configures Clerk as the authentication provider.
 * The domain must match your Clerk Frontend API URL.
 */

export default {
  providers: [
    {
      domain: "https://heroic-stinkbug-5.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
