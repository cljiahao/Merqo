import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchVendorMetrics } from "@/lib/vendor-metrics-client";

const kit = {
  slug: "qkit",
  app_url: "https://qkit.vercel.app",
  metrics_secret: "s",
};

const goodPayload = {
  product: "qkit",
  generated_at: "2026-07-26T00:00:00.000Z",
  metrics: [
    { key: "orders_7d", label: "Orders (7d)", value: "42" },
    {
      key: "avg_wait",
      label: "Avg wait",
      value: "6 min",
      hint: "down from 9 min",
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("fetchVendorMetrics", () => {
  it("calls the kit's vendor-metrics endpoint with the bearer and email", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(goodPayload), { status: 200 }),
      );
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.metrics).toHaveLength(2);
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit.vercel.app/api/merqo/vendor-metrics?email=a%40x.com",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s",
    );
  });

  it("ok:false on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the payload fails schema validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ product: "qkit" }), { status: 200 }),
    );
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when a 200 body is not parseable JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the kit has no app_url or metrics_secret (never calls fetch, i.e. not connected yet)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await fetchVendorMetrics(
      { slug: "ghostkit", app_url: null, metrics_secret: null },
      "a@x.com",
    );
    expect(r).toEqual({ ok: false, slug: "ghostkit" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a payload with an empty metrics array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          product: "qkit",
          generated_at: "2026-07-26T00:00:00.000Z",
          metrics: [],
        }),
        { status: 200 },
      ),
    );
    const r = await fetchVendorMetrics(kit, "a@x.com");
    expect(r).toEqual({
      ok: true,
      slug: "qkit",
      data: {
        product: "qkit",
        generated_at: "2026-07-26T00:00:00.000Z",
        metrics: [],
      },
    });
  });
});
