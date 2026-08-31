import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadVendorContextMock, provisionVendorKitsMock, revalidatePathMock } =
  vi.hoisted(() => ({
    loadVendorContextMock: vi.fn(),
    provisionVendorKitsMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));
vi.mock("@/lib/vendor", () => ({ loadVendorContext: loadVendorContextMock }));
vi.mock("@/lib/vendor-sync", () => ({
  provisionVendorKits: provisionVendorKitsMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { activateKitsAction } from "@/app/actions/activate-kits";

describe("activateKitsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error when not signed in", async () => {
    loadVendorContextMock.mockResolvedValue({ user: null, links: [] });
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: false,
      error: "Please sign in first.",
    });
    expect(provisionVendorKitsMock).not.toHaveBeenCalled();
  });

  it("calls provisionVendorKits for the signed-in vendor and revalidates /dashboard", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      links: [],
    });
    provisionVendorKitsMock.mockResolvedValue({
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
      ],
    });
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
      ],
    });
    expect(provisionVendorKitsMock).toHaveBeenCalledWith(
      { id: "u1", email: "v@x.com" },
      ["qkit"],
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects non-array/oversized input without calling provisionVendorKits", async () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `kit${i}`);
    const res = await activateKitsAction(tooMany);
    expect(res).toEqual({
      success: false,
      error: "Could not activate your kits. Try again in a moment.",
    });
    expect(provisionVendorKitsMock).not.toHaveBeenCalled();
    expect(loadVendorContextMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when provisionVendorKits throws", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      links: [],
    });
    provisionVendorKitsMock.mockRejectedValue(new Error("boom"));
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: false,
      error: "Could not activate your kits. Try again in a moment.",
    });
  });
});
