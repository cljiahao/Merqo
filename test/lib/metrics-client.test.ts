import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchProductMetrics } from "@/lib/metrics-client";

const goodPayload = {
  product: "qkit",
  generated_at: new Date().toISOString(),
  revenue_cents_30d: 1,
  revenue_cents_all: 2,
  gmv_cents_30d: 3,
  active_vendors: 4,
  orders_7d: 5,
  orders_prev_7d: 6,
  signups_7d: 7,
  pro_vendors: 8,
  total_vendors: 9,
  pending_upgrade_requests: 10,
  funnel: { signed_up: 9, with_booth: 5, with_order: 4, pro: 8 },
};
const row = {
  slug: "qkit",
  name: "Q",
  metrics_url: "https://x/api/merqo/metrics",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("fetchProductMetrics", () => {
  it("sends the bearer and returns ok on a valid payload", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(goodPayload), { status: 200 }));
    const r = await fetchProductMetrics(row);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.active_vendors).toBe(4);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s");
  });

  it("reason=auth on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const r = await fetchProductMetrics(row);
    expect(r).toMatchObject({ ok: false, reason: "auth" });
  });

  it("reason=unreachable when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await fetchProductMetrics(row);
    expect(r).toMatchObject({ ok: false, reason: "unreachable" });
  });

  it("reason=unreachable on 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 503 }));
    const r = await fetchProductMetrics(row);
    expect(r).toMatchObject({ ok: false, reason: "unreachable" });
  });

  it("reason=bad_shape when the payload fails schema validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ product: "qkit" }), { status: 200 }),
    );
    const r = await fetchProductMetrics(row);
    expect(r).toMatchObject({ ok: false, reason: "bad_shape" });
  });

  it("reason=unreachable when the registry row lacks a url or secret", async () => {
    const r = await fetchProductMetrics({
      slug: "x",
      name: "X",
      metrics_url: null,
      metrics_secret: null,
    });
    expect(r).toMatchObject({ ok: false, reason: "unreachable" });
  });
});
