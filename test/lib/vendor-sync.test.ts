import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  checkVendorStatus,
  upsertsFromChecks,
  provisionVendorKit,
  provisionVendorKits,
  type ProvisionResult,
} from "@/lib/vendor-sync";

const { selectMock, eqMock, createServiceClientMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

function fakeSupabase() {
  return {
    from: vi.fn(() => ({
      select: selectMock,
    })),
  };
}

beforeEach(() => {
  selectMock.mockReset();
  eqMock.mockReset();
  createServiceClientMock.mockReset();
});

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

describe("listLiveProducts", () => {
  it("selects provision_secret and filters on status = 'live'", async () => {
    const mockProducts = [
      {
        slug: "qkit",
        name: "QKit",
        app_url: "https://qkit.vercel.app",
        metrics_url: "https://metrics.qkit.example.com",
        metrics_secret: "ms1",
        provision_secret: "ps1",
      },
      {
        slug: "loopkit",
        name: "LoopKit",
        app_url: "https://loopkit.vercel.app",
        metrics_url: "https://metrics.loopkit.example.com",
        metrics_secret: "ms2",
        provision_secret: null,
      },
    ];
    eqMock.mockResolvedValue({ data: mockProducts, error: null });
    selectMock.mockReturnValue({ eq: eqMock });
    createServiceClientMock.mockResolvedValue(fakeSupabase());

    const { listLiveProducts } = await import("@/lib/products");
    const result = await listLiveProducts();

    expect(result).toEqual(mockProducts);
    expect(selectMock).toHaveBeenCalledWith(
      "slug, name, app_url, metrics_url, metrics_secret, provision_secret",
    );
    expect(eqMock).toHaveBeenCalledWith("status", "live");
  });

  it("includes provision_secret in the result shape", async () => {
    const mockProducts = [
      {
        slug: "qkit",
        name: "QKit",
        app_url: null,
        metrics_url: null,
        metrics_secret: null,
        provision_secret: "secret123",
      },
    ];
    eqMock.mockResolvedValue({ data: mockProducts, error: null });
    selectMock.mockReturnValue({ eq: eqMock });
    createServiceClientMock.mockResolvedValue(fakeSupabase());

    const { listLiveProducts } = await import("@/lib/products");
    const result = await listLiveProducts();

    expect(result[0]).toHaveProperty("provision_secret");
  });
});

const provisionKit = {
  slug: "qkit",
  app_url: "https://qkit.vercel.app",
  provision_secret: "p",
};

describe("provisionVendorKit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls the kit's vendor-provision endpoint with the bearer and user_id", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, already_existed: false, plan: "free" }),
          { status: 200 },
        ),
      );
    const r = await provisionVendorKit(provisionKit, "u1");
    expect(r).toEqual({
      ok: true,
      slug: "qkit",
      alreadyExisted: false,
      plan: "free",
    });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit.vercel.app/api/merqo/vendor-provision",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer p",
    );
    expect(JSON.parse(init.body as string)).toEqual({ user_id: "u1" });
  });

  it("ok:false when fetch throws, after exactly one retry", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await provisionVendorKit(provisionKit, "u1", { retryDelayMs: 1 });
    expect(r).toEqual({ ok: false, slug: "qkit" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the retry after an initial failure", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, already_existed: true, plan: "free" }),
          { status: 200 },
        ),
      );
    const r = await provisionVendorKit(provisionKit, "u1", { retryDelayMs: 1 });
    expect(r).toEqual({
      ok: true,
      slug: "qkit",
      alreadyExisted: true,
      plan: "free",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("ok:false when the kit has no app_url or provision_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await provisionVendorKit(
      { slug: "ghostkit", app_url: null, provision_secret: null },
      "u1",
    );
    expect(r).toEqual({ ok: false, slug: "ghostkit" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("provisionVendorKits", () => {
  afterEach(() => vi.restoreAllMocks());

  it("upserts vendor_links only for successful provisions, one failure doesn't block the other", async () => {
    // Hermetic per the lesson learned in the "listLiveProducts
    // (post-0013 migration)" fix earlier in this file: this test must not
    // depend on a locally-running Supabase instance (CI's `test` job has no
    // Supabase env vars). listLiveProducts is spied directly so the fan-out
    // logic under test controls exactly which "live kits" exist, and
    // createServiceClient (already mocked module-wide above) is given a
    // fake client so the vendor_links upsert/read-back never touch a real
    // database either.
    const products = await import("@/lib/products");
    vi.spyOn(products, "listLiveProducts").mockResolvedValue([
      {
        slug: "qkit",
        name: "QKit",
        app_url: "https://qkit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: "p1",
      },
      {
        slug: "loopkit",
        name: "LoopKit",
        app_url: "https://loopkit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: "p2",
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("qkit")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                already_existed: false,
                plan: "free",
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error("ECONNREFUSED"));
      },
    );

    const vendorLinksUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const vendorLinksEqMock = vi.fn().mockResolvedValue({
      data: [{ product_slug: "qkit", status: "active", plan: "free" }],
      error: null,
    });
    const vendorLinksSelectMock = vi.fn(() => ({ eq: vendorLinksEqMock }));
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        upsert: vendorLinksUpsertMock,
        select: vendorLinksSelectMock,
      })),
    });

    const { results, links } = await provisionVendorKits(
      { id: "u1", email: "v@x.com" },
      ["qkit", "loopkit"],
    );
    const bySlug = new Map<string, ProvisionResult>(
      results.map((r) => [r.slug, r]),
    );
    expect(bySlug.get("qkit")?.ok).toBe(true);
    expect(bySlug.get("loopkit")?.ok).toBe(false);

    expect(vendorLinksUpsertMock).toHaveBeenCalledTimes(1);
    expect(vendorLinksUpsertMock.mock.calls[0][0]).toEqual([
      {
        email: "v@x.com",
        product_slug: "qkit",
        status: "active",
        last_verified_at: expect.any(String),
        plan: "free",
      },
    ]);
    expect(links).toEqual([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);
  }, 10000);
});
