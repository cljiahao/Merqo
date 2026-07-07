import { describe, it, expect } from "vitest";
import { classifyHealth, LAGGING_MS, FRESHNESS_MS } from "@/lib/health";
import type { MetricsResult } from "@/lib/metrics-client";

const NOW = 1_700_000_000_000;

const ok = (over: {
  durationMs?: number;
  generated_at?: string;
}): MetricsResult => ({
  ok: true,
  product: "qkit",
  durationMs: over.durationMs ?? 50,
  data: {
    product: "qkit",
    generated_at: over.generated_at ?? new Date(NOW).toISOString(),
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
  },
});

describe("classifyHealth", () => {
  it("down when the result failed, whatever the reason", () => {
    const r: MetricsResult = {
      ok: false,
      product: "x",
      durationMs: 10,
      reason: "unreachable",
    };
    expect(classifyHealth(r, NOW)).toBe("down");
  });

  it("reporting when ok, fast, and fresh", () => {
    expect(classifyHealth(ok({ durationMs: 100 }), NOW)).toBe("reporting");
  });

  it("lagging when the call was slow", () => {
    expect(classifyHealth(ok({ durationMs: LAGGING_MS + 1 }), NOW)).toBe(
      "lagging",
    );
  });

  it("lagging when the payload is stale", () => {
    const stale = new Date(NOW - FRESHNESS_MS - 1).toISOString();
    expect(classifyHealth(ok({ generated_at: stale }), NOW)).toBe("lagging");
  });

  it("lagging when generated_at is unparseable", () => {
    expect(classifyHealth(ok({ generated_at: "not-a-date" }), NOW)).toBe(
      "lagging",
    );
  });
});
