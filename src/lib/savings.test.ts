import { describe, it, expect } from "vitest";
import { computeVendorSavings } from "./savings";
import type { VendorLink } from "./vendor";

function link(overrides: Partial<VendorLink>): VendorLink {
  return { product_slug: "qkit", status: "active", plan: "free", ...overrides };
}

describe("computeVendorSavings", () => {
  it("returns all-zero totals and an empty perKit for no links", () => {
    const result = computeVendorSavings([]);
    expect(result).toEqual({
      perKit: [],
      totalHoursPerWeek: 0,
      totalCostCentsPerMonth: 0,
      totalUpsideCostCentsPerMonth: 0,
    });
  });

  it("uses the free-tier assumption for an active free-plan kit, with upside toward pro", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
    ]);
    expect(result.perKit).toEqual([
      {
        slug: "qkit",
        hoursPerWeek: 3,
        costCentsPerMonth: 23000,
        upsideHoursPerWeek: 3,
        upsideCostCentsPerMonth: 24000,
      },
    ]);
    expect(result.totalHoursPerWeek).toBe(3);
    expect(result.totalCostCentsPerMonth).toBe(23000);
    expect(result.totalUpsideCostCentsPerMonth).toBe(24000);
  });

  it("uses the pro-tier assumption with zero upside for an active pro-plan kit", () => {
    const result = computeVendorSavings([
      link({ product_slug: "loopkit", plan: "pro" }),
    ]);
    expect(result.perKit).toEqual([
      {
        slug: "loopkit",
        hoursPerWeek: 4,
        costCentsPerMonth: 30000,
        upsideHoursPerWeek: 0,
        upsideCostCentsPerMonth: 0,
      },
    ]);
    expect(result.totalUpsideCostCentsPerMonth).toBe(0);
  });

  it("treats a null plan on an active link as free tier", () => {
    const result = computeVendorSavings([
      link({ product_slug: "paykit", plan: null }),
    ]);
    expect(result.perKit[0]).toMatchObject({
      hoursPerWeek: 2,
      costCentsPerMonth: 15000,
    });
  });

  it("skips a waitlist (non-active) link entirely", () => {
    const result = computeVendorSavings([
      link({ status: "waitlist" as never }),
    ]);
    expect(result.perKit).toEqual([]);
  });

  it("skips an active link to a slug with no assumption entry, without polluting totals", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
      link({ product_slug: "shopkit", plan: "free" }),
    ]);
    expect(result.perKit.map((k) => k.slug)).toEqual(["qkit"]);
    expect(result.totalCostCentsPerMonth).toBe(23000);
  });

  it("sums per-kit totals across multiple active kits", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
      link({ product_slug: "paykit", plan: "pro" }),
    ]);
    expect(result.totalHoursPerWeek).toBe(3 + 5);
    expect(result.totalCostCentsPerMonth).toBe(23000 + 39000);
    expect(result.totalUpsideCostCentsPerMonth).toBe(24000);
  });
});
