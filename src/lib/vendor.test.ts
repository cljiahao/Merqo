import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, getUserMock, fromMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { tilesForLinks, requireVendorSession } from "./vendor";

describe("requireVendorSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }));
  });

  it("redirects to /login when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await requireVendorSession();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the vendor context without redirecting when signed in", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });

    const result = await requireVendorSession();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result.user.id).toBe("u1");
    expect(result.isTeam).toBe(false);
    expect(result.links).toEqual([]);
  });
});

describe("tilesForLinks", () => {
  it("buckets active, waitlist, and needs_setup links separately", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "shopkit", status: "waitlist", plan: null },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(pending.map((t) => t.slug)).toEqual(["shopkit"]);
    expect(needsSetup.map((t) => t.slug)).toEqual(["paykit"]);
  });

  it("drops a link to a slug KITS doesn't know about, in any bucket", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "unknown-kit", status: "needs_setup", plan: null },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
    expect(needsSetup).toEqual([]);
  });

  it("never sets plan on a needs_setup tile (plan only means anything once active)", () => {
    const { needsSetup } = tilesForLinks([
      { product_slug: "paykit", status: "needs_setup", plan: "pro" },
    ]);
    expect(needsSetup[0].plan).toBeUndefined();
  });

  it("still populates plan on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });
});
