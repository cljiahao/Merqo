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

import { provisionVendorKits } from "./vendor-sync";

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
