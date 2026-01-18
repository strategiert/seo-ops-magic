import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

/**
 * Convex + Clerk Provider
 *
 * This provider wraps the application with:
 * 1. Clerk authentication (replaces Supabase Auth)
 * 2. Convex real-time database client
 *
 * Environment variables required:
 * - VITE_CLERK_PUBLISHABLE_KEY: Clerk publishable key
 * - VITE_CONVEX_URL: Convex deployment URL
 */

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Only initialize if environment variables are set
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

interface ConvexClientProviderProps {
  children: ReactNode;
}

/**
 * Main provider component that sets up Clerk and Convex
 *
 * Usage in main.tsx or App.tsx:
 * ```tsx
 * <ConvexClientProvider>
 *   <App />
 * </ConvexClientProvider>
 * ```
 */
export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  // If Convex/Clerk are not configured, render children without providers
  // This allows gradual migration - features can still work with Supabase
  if (!convex || !clerkPublishableKey) {
    console.warn(
      "Convex or Clerk not configured. Set VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY to enable."
    );
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

/**
 * Export the Convex client for use in other parts of the app
 * Can be used for direct API calls if needed
 */
export { convex };
