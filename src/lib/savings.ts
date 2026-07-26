import type { VendorLink } from "@/lib/vendor";

export type SavingsAssumption = {
  hoursPerWeek: number;
  costCentsPerMonth: number;
};

export type KitSavingsAssumptions = {
  free: SavingsAssumption;
  pro: SavingsAssumption;
};

/**
 * Flat per-kit/per-tier estimates — no real per-vendor usage data exists in
 * the metrics pipeline (it only reports aggregates across all of a kit's
 * vendors). $/hour basis: S$18/hr, rounded from the Singapore hawker-stall
 * staff wage (~S$17.4/hr, Jooble, May 2025) as the closest proxy for the
 * owner/staff time these kits displace. $/mo = hrs/week × 4.33 × $18,
 * rounded to the nearest $10. See
 * docs/superpowers/specs/2026-07-26-merqo-dashboard-savings-estimate-design.md
 * for the full per-kit rationale and citations.
 */
export const SAVINGS_ASSUMPTIONS: Record<string, KitSavingsAssumptions> = {
  qkit: {
    free: { hoursPerWeek: 3, costCentsPerMonth: 23000 },
    pro: { hoursPerWeek: 6, costCentsPerMonth: 47000 },
  },
  loopkit: {
    free: { hoursPerWeek: 2, costCentsPerMonth: 15000 },
    pro: { hoursPerWeek: 4, costCentsPerMonth: 30000 },
  },
  paykit: {
    free: { hoursPerWeek: 2, costCentsPerMonth: 15000 },
    pro: { hoursPerWeek: 5, costCentsPerMonth: 39000 },
  },
};

export type KitSavings = {
  slug: string;
  hoursPerWeek: number;
  costCentsPerMonth: number;
  /** Extra saved if upgraded to Pro. Zero when already on Pro. */
  upsideHoursPerWeek: number;
  upsideCostCentsPerMonth: number;
};

export type VendorSavings = {
  perKit: KitSavings[];
  totalHoursPerWeek: number;
  totalCostCentsPerMonth: number;
  totalUpsideCostCentsPerMonth: number;
};

/** A kit with no SAVINGS_ASSUMPTIONS entry is skipped, not zero-filled, so
 *  the total never silently includes a kit it has no real basis for. */
export function computeVendorSavings(links: VendorLink[]): VendorSavings {
  const perKit: KitSavings[] = [];
  let totalHoursPerWeek = 0;
  let totalCostCentsPerMonth = 0;
  let totalUpsideCostCentsPerMonth = 0;

  for (const link of links) {
    if (link.status !== "active") continue;
    const assumptions = SAVINGS_ASSUMPTIONS[link.product_slug];
    if (!assumptions) continue;

    const isPro = link.plan === "pro";
    const tier = isPro ? assumptions.pro : assumptions.free;
    const upsideHoursPerWeek = isPro
      ? 0
      : assumptions.pro.hoursPerWeek - assumptions.free.hoursPerWeek;
    const upsideCostCentsPerMonth = isPro
      ? 0
      : assumptions.pro.costCentsPerMonth - assumptions.free.costCentsPerMonth;

    perKit.push({
      slug: link.product_slug,
      hoursPerWeek: tier.hoursPerWeek,
      costCentsPerMonth: tier.costCentsPerMonth,
      upsideHoursPerWeek,
      upsideCostCentsPerMonth,
    });

    totalHoursPerWeek += tier.hoursPerWeek;
    totalCostCentsPerMonth += tier.costCentsPerMonth;
    totalUpsideCostCentsPerMonth += upsideCostCentsPerMonth;
  }

  return {
    perKit,
    totalHoursPerWeek,
    totalCostCentsPerMonth,
    totalUpsideCostCentsPerMonth,
  };
}
