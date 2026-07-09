import { describe, it, expect, vi, afterEach } from "vitest";
import { checkVendorStatus, upsertsFromChecks } from "@/lib/vendor-sync";

const kit = {
  slug: "qkit",
  app_url: "https://qkit.vercel.app",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("checkVendorStatus", () => {
  it("calls the kit's vendor-status endpoint with the bearer and email", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active: true, plan: "pro" }), {
        status: 200,
      }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: true, slug: "qkit", active: true, plan: "pro" });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit.vercel.app/api/merqo/vendor-status?email=a%40x.com",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s",
    );
  });

  it("returns active:false, plan:null verbatim from a negative match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active: false, plan: null }), {
        status: 200,
      }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: true, slug: "qkit", active: false, plan: null });
  });

  it("ok:false on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the 200 body fails schema validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nonsense: true }), { status: 200 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the 200 body isn't valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the kit has no app_url or metrics_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await checkVendorStatus(
      {
        slug: "ghostkit",
        app_url: null,
        metrics_secret: null,
      },
      "a@x.com",
    );
    expect(r).toEqual({ ok: false, slug: "ghostkit" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("upsertsFromChecks", () => {
  it("keeps only active:true, ok:true checks, lowercases the email, carries plan", () => {
    const out = upsertsFromChecks(
      "A@X.com",
      [
        { ok: true, slug: "qkit", active: true, plan: "pro" },
        { ok: true, slug: "loopkit", active: false, plan: null },
        { ok: false, slug: "shopkit" },
      ],
      "2026-07-09T00:00:00.000Z",
    );
    expect(out).toEqual([
      {
        email: "a@x.com",
        product_slug: "qkit",
        status: "active",
        last_verified_at: "2026-07-09T00:00:00.000Z",
        plan: "pro",
      },
    ]);
  });

  it("carries a null plan through when the kit reports one", () => {
    const out = upsertsFromChecks(
      "a@x.com",
      [{ ok: true, slug: "qkit", active: true, plan: null }],
      "2026-07-09T00:00:00.000Z",
    );
    expect(out[0].plan).toBeNull();
  });

  it("returns an empty array when nothing matched", () => {
    const out = upsertsFromChecks(
      "a@x.com",
      [{ ok: false, slug: "qkit" }],
      "2026-07-09T00:00:00.000Z",
    );
    expect(out).toEqual([]);
  });
});
