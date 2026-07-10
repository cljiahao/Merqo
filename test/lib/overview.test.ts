import { describe, it, expect } from "vitest";
import { summarizeOverview } from "@/lib/overview";
import type { MetricsResult } from "@/lib/metrics-client";
import type { MetricsPayload } from "@/lib/metrics-schema";

const ok = (slug: string, over: Partial<MetricsPayload>): MetricsResult => {
  const data: MetricsPayload = {
    product: slug,
    generated_at: "t",
    revenue_cents_30d: 0,
    revenue_cents_all: 0,
    gmv_cents_30d: 0,
    active_vendors: 0,
    orders_7d: 0,
    orders_prev_7d: 0,
    signups_7d: 0,
    pro_vendors: 0,
    total_vendors: 0,
    pending_upgrade_requests: 0,
    funnel: { signed_up: 0, with_booth: 0, with_order: 0, pro: 0 },
    ...over,
  };
  return { ok: true, product: slug, data, durationMs: 0 };
};

describe("summarizeOverview", () => {
  it("sums numeric fields across ok products and ignores failed ones", () => {
    const results: MetricsResult[] = [
      ok("qkit", {
        revenue_cents_all: 1000,
        active_vendors: 3,
        pending_upgrade_requests: 2,
        orders_7d: 5,
        orders_prev_7d: 4,
      }),
      ok("loopkit", {
        revenue_cents_all: 500,
        active_vendors: 2,
        pending_upgrade_requests: 1,
        orders_7d: 4,
        orders_prev_7d: 6,
      }),
      { ok: false, product: "down", reason: "unreachable", durationMs: 0 },
    ];
    const t = summarizeOverview(results);
    expect(t.revenue_cents_all).toBe(1500);
    expect(t.active_vendors).toBe(5);
    expect(t.pending_upgrade_requests).toBe(3);
    expect(t.orders_7d).toBe(9);
    expect(t.orders_prev_7d).toBe(10);
    expect(t.products_reporting).toBe(2);
    expect(t.products_down).toBe(1);
  });
});
