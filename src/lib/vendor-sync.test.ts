import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, createServiceClientMock, listLiveProductsMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    listLiveProductsMock: vi.fn(),
  }),
);
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/products", () => ({
  listLiveProducts: listLiveProductsMock,
}));

import { provisionVendorKits, syncVendorKits } from "./vendor-sync";

const USER = { id: "u1", email: "vendor@business.sg" };

function upsertCapturingClient() {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  fromMock.mockImplementation((table: string) => {
    if (table !== "vendor_links") throw new Error(`unexpected table: ${table}`);
    return {
      upsert: upsertMock,
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    };
  });
  return { upsertMock };
}

describe("provisionVendorKits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceClientMock.mockResolvedValue({ from: fromMock });
  });

  it("upserts status needs_setup when a kit reports needs_setup: true", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      {
        slug: "paykit",
        app_url: "https://paykit.test",
        provision_secret: "s1",
      },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        already_existed: false,
        plan: null,
        needs_setup: true,
      }),
    });

    await provisionVendorKits(USER, ["paykit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          product_slug: "paykit",
          status: "needs_setup",
        }),
      ],
      { onConflict: "email,product_slug" },
    );
  });

  it("upserts status active when a kit's response omits needs_setup (qkit/loopkit shape)", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      { slug: "qkit", app_url: "https://qkit.test", provision_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, already_existed: false, plan: "free" }),
    });

    await provisionVendorKits(USER, ["qkit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ product_slug: "qkit", status: "active" })],
      { onConflict: "email,product_slug" },
    );
  });

  it("upserts status active when a kit explicitly reports needs_setup: false", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      {
        slug: "paykit",
        app_url: "https://paykit.test",
        provision_secret: "s1",
      },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        already_existed: false,
        plan: "free",
        needs_setup: false,
      }),
    });

    await provisionVendorKits(USER, ["paykit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ product_slug: "paykit", status: "active" })],
      { onConflict: "email,product_slug" },
    );
  });
});

describe("syncVendorKits throttle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceClientMock.mockResolvedValue({ from: fromMock });
  });

  const eqReturning = (value: unknown) => ({ eq: () => value });

  function syncClient(
    state: { last_synced_at: string } | null,
    links: unknown[] = [],
  ) {
    const syncStateUpsert = vi.fn().mockResolvedValue({ error: null });
    const syncStateTable = {
      select: () => eqReturning({ maybeSingle: async () => ({ data: state }) }),
      upsert: syncStateUpsert,
    };
    const vendorLinksTable = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: () => eqReturning(Promise.resolve({ data: links, error: null })),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "vendor_sync_state") return syncStateTable;
      if (table === "vendor_links") return vendorLinksTable;
      throw new Error(`unexpected table: ${table}`);
    });
    return { syncStateUpsert };
  }

  it("skips the kit fan-out when a sync completed within the TTL", async () => {
    const { syncStateUpsert } = syncClient(
      { last_synced_at: new Date().toISOString() },
      [{ product_slug: "qkit", status: "active", plan: "free" }],
    );
    global.fetch = vi.fn();

    const links = await syncVendorKits("Vendor@Business.SG");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(listLiveProductsMock).not.toHaveBeenCalled();
    expect(syncStateUpsert).not.toHaveBeenCalled();
    expect(links).toEqual([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);
  });

  it("runs the fan-out and records the sync when the last sync is stale", async () => {
    const { syncStateUpsert } = syncClient({
      last_synced_at: new Date(Date.now() - 120_000).toISOString(),
    });
    listLiveProductsMock.mockResolvedValue([
      { slug: "qkit", app_url: "https://qkit.test", metrics_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: false, plan: null }),
    });

    await syncVendorKits("vendor@business.sg");

    expect(listLiveProductsMock).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalled();
    expect(syncStateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "vendor@business.sg" }),
      { onConflict: "email" },
    );
  });

  it("bypasses the TTL when force is passed", async () => {
    syncClient({ last_synced_at: new Date().toISOString() });
    listLiveProductsMock.mockResolvedValue([
      { slug: "qkit", app_url: "https://qkit.test", metrics_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: false, plan: null }),
    });

    await syncVendorKits("vendor@business.sg", { force: true });

    expect(global.fetch).toHaveBeenCalled();
  });

  it("runs the fan-out when no prior sync state exists", async () => {
    syncClient(null);
    listLiveProductsMock.mockResolvedValue([
      { slug: "qkit", app_url: "https://qkit.test", metrics_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: false, plan: null }),
    });

    await syncVendorKits("vendor@business.sg");

    expect(global.fetch).toHaveBeenCalled();
  });

  it("degrades to [] when the vendor_links read fails", async () => {
    const linksReadError = { select: () => ({ eq: () => value }) };
    const value = Promise.resolve({
      data: null,
      error: { message: "read boom" },
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "vendor_sync_state") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "vendor_links") return linksReadError;
      throw new Error(`unexpected table: ${table}`);
    });
    listLiveProductsMock.mockResolvedValue([]);
    global.fetch = vi.fn();

    const links = await syncVendorKits("vendor@business.sg");

    expect(links).toEqual([]);
  });

  it("still returns links when the sync-state upsert fails (best-effort)", async () => {
    const syncStateUpsert = vi
      .fn()
      .mockResolvedValue({ error: { message: "state boom" } });
    fromMock.mockImplementation((table: string) => {
      if (table === "vendor_sync_state") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
          upsert: syncStateUpsert,
        };
      }
      if (table === "vendor_links") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ product_slug: "qkit", status: "active", plan: null }],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    listLiveProductsMock.mockResolvedValue([]);
    global.fetch = vi.fn();

    const links = await syncVendorKits("vendor@business.sg");

    expect(syncStateUpsert).toHaveBeenCalled();
    expect(links).toEqual([
      { product_slug: "qkit", status: "active", plan: null },
    ]);
  });
});
