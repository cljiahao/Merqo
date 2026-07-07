import type { GrantStatus } from "@/lib/admin";

export type OnboardingCounts = {
  waitlisted: number;
  granted: number;
  using: number;
};

/**
 * Merqo-level onboarding funnel. `links` are flattened vendor↔kit grants;
 * `usingCount` is the sum of kits' reported active vendors (arrives over the
 * metrics API, so it's passed in rather than derived here).
 * The three counts are distinct populations: `waitlisted` and `granted` are mutually-exclusive vendor_links statuses, while `using` comes from kits' own metrics (vendors don't log into Merqo in Phase 1), so `using` can exceed `granted` — Phase 2 reconciles this.
 */
export function onboardingFunnel(
  links: { status: GrantStatus }[],
  usingCount: number,
): OnboardingCounts {
  let waitlisted = 0;
  let granted = 0;
  for (const l of links) {
    if (l.status === "active") granted += 1;
    else waitlisted += 1;
  }
  return { waitlisted, granted, using: usingCount };
}
