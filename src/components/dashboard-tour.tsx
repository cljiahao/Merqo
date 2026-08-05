"use client";

import { usePathname, useRouter } from "next/navigation";
import { DashboardTour as SharedDashboardTour } from "@merqo/ui";
import { tourSteps } from "./tour-steps";
import { markTourSeen } from "@/app/dashboard/tour-actions";

/**
 * Merqo's wiring for `@merqo/ui`'s `DashboardTour`: supplies this app's own
 * step content, mark-seen action, and routing, while the tour mechanism
 * itself (driver.js lifecycle, floating replay button, popover styling) is
 * fully owned by the shared component. `tourSteps` takes no arguments (no
 * mobile/desktop split — Merqo's dashboard nav has no burger or nav links
 * to spotlight differently by breakpoint), so it's passed straight through
 * as the lazy resolver `@merqo/ui`'s `steps` prop expects.
 */
export function DashboardTour({ seen }: { seen: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SharedDashboardTour
      steps={tourSteps}
      seen={seen}
      onFirstSeen={markTourSeen}
      isHomeRoute={pathname === "/dashboard"}
      navigateHome={() => router.push("/dashboard")}
      scopeClassName="merqo-tour"
    />
  );
}
