import { useCallback, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tourStyles.css";
import { TOUR_STEPS, DASHBOARD_TOUR_STEPS } from "./tourSteps";

export interface UseTourOptions {
  /** Callback when tour is completed or skipped */
  onComplete?: () => void;
  /** Callback when tour is destroyed */
  onDestroy?: () => void;
}

/**
 * Hook for managing the onboarding tour with Driver.js
 *
 * @example
 * const { startTour, stopTour, isActive } = useTour({
 *   onComplete: () => markOnboardingComplete()
 * });
 *
 * // Start the main tour
 * startTour();
 *
 * // Start dashboard-specific tour
 * startTour("dashboard");
 */
export function useTour(options: UseTourOptions = {}) {
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(
    (tourType: "main" | "dashboard" = "main") => {
      // Destroy existing tour if any
      if (driverRef.current) {
        driverRef.current.destroy();
      }

      const steps = tourType === "dashboard" ? DASHBOARD_TOUR_STEPS : TOUR_STEPS;

      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.5)",
        stagePadding: 8,
        stageRadius: 8,
        popoverClass: "driver-popover-custom",
        steps,
        // German button labels
        nextBtnText: "Weiter",
        prevBtnText: "Zurück",
        doneBtnText: "Fertig",
        progressText: "{{current}} von {{total}}",
        onDestroyStarted: () => {
          // Called when user clicks close or completes tour
          options.onComplete?.();
          driverObj.destroy();
        },
        onDestroyed: () => {
          options.onDestroy?.();
          driverRef.current = null;
        },
      });

      driverRef.current = driverObj;
      driverObj.drive();
    },
    [options]
  );

  const stopTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  const isActive = useCallback(() => {
    return driverRef.current?.isActive() ?? false;
  }, []);

  return {
    startTour,
    stopTour,
    isActive,
  };
}
