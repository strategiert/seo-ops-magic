import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ConvexClientProvider } from "./providers/ConvexClientProvider";

/**
 * Main entry point with Convex + Clerk providers
 *
 * The ConvexClientProvider wraps the app with:
 * - Clerk authentication (if configured)
 * - Convex real-time database client (if configured)
 *
 * If VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY are not set,
 * the app will fall back to the existing Supabase implementation.
 */
createRoot(document.getElementById("root")!).render(
  <ConvexClientProvider>
    <App />
  </ConvexClientProvider>
);
