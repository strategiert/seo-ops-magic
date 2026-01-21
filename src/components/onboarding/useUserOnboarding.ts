import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";

const LS_KEY = "seo_content_ops.onboarding_completed";

/**
 * Hook for managing user onboarding state.
 *
 * Uses localStorage-first approach for optimistic UI (no flicker),
 * with optional backend sync in the future.
 *
 * @example
 * const { isFirstTimeUser, markComplete, resetOnboarding } = useUserOnboarding();
 *
 * useEffect(() => {
 *   if (isFirstTimeUser) {
 *     startTour();
 *   }
 * }, [isFirstTimeUser]);
 */
export function useUserOnboarding() {
  const { user } = useUser();
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    if (!user) {
      setIsChecked(true);
      return;
    }

    // localStorage-first: check immediately without flicker
    const localDone = localStorage.getItem(LS_KEY) === "true";

    if (localDone) {
      setIsFirstTimeUser(false);
    } else {
      // User hasn't completed onboarding
      setIsFirstTimeUser(true);
    }

    setIsChecked(true);
  }, [user]);

  /**
   * Mark onboarding as complete
   */
  const markComplete = useCallback(() => {
    localStorage.setItem(LS_KEY, "true");
    setIsFirstTimeUser(false);

    // Future: sync to backend
    // await completeOnboardingMutation();
  }, []);

  /**
   * Reset onboarding state (for "restart tour" feature)
   */
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setIsFirstTimeUser(true);
  }, []);

  return {
    /** Whether this is the user's first time (tour should start) */
    isFirstTimeUser,
    /** Whether the check has completed (use for loading states) */
    isChecked,
    /** Mark onboarding as complete */
    markComplete,
    /** Reset to show tour again */
    resetOnboarding,
  };
}
