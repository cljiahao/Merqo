import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getVendorActivity } from "./vendor-activity-client";

const KIT = {
  slug: "qkit",
  app_url: "https://qkit.test",
  metrics_secret: "s1",
};

const PAYLOAD = {
  active: true,
  plan: "pro" as const,
  status: "healthy" as const,
  metrics: [{ label: "Orders (30d)", value: "42" }],
  lastActivityAt: "2026-08-20T00:00:00.000Z",
};

describe("getVendorActivity", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns ok:true with the parsed payload on a 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PAYLOAD,
    });

    const result = await getVendorActivity(KIT, "vendor@business.sg");

    expect(result).toEqual({ ok: true, slug: "qkit", data: PAYLOAD });
  });

  it("returns ok:false on a 404 (vendor never touched this kit)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await getVendorActivity(KIT, "vendor@business.sg");

    expect(result).toEqual({ ok: false, slug: "qkit" });
  });

  it("returns ok:false without fetching when app_url/metrics_secret are missing", async () => {
    global.fetch = vi.fn();

    const result = await getVendorActivity(
      { slug: "stockkit", app_url: null, metrics_secret: null },
      "vendor@business.sg",
    );

    expect(result).toEqual({ ok: false, slug: "stockkit" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns ok:false on a schema mismatch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bogus: true }),
    });

    const result = await getVendorActivity(KIT, "vendor@business.sg");

    expect(result).toEqual({ ok: false, slug: "qkit" });
  });

  it("returns ok:false on a network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await getVendorActivity(KIT, "vendor@business.sg");

    expect(result).toEqual({ ok: false, slug: "qkit" });
  });
});
