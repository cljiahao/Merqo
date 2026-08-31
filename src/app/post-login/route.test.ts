import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadVendorContextMock, syncVendorKitsMock } = vi.hoisted(() => ({
  loadVendorContextMock: vi.fn(),
  syncVendorKitsMock: vi.fn(),
}));
vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return { ...actual, loadVendorContext: loadVendorContextMock };
});
vi.mock("@/lib/vendor-sync", () => ({ syncVendorKits: syncVendorKitsMock }));

import { GET } from "./route";

const request = new Request("https://merqo.example.com/post-login");

beforeEach(() => {
  vi.clearAllMocks();
  syncVendorKitsMock.mockResolvedValue([]);
});

describe("GET /post-login", () => {
  it("redirects to /login when there is no session", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: null,
      isTeam: false,
      links: [],
    });

    const res = await GET(request);

    expect(res.headers.get("location")).toBe("https://merqo.example.com/login");
    expect(syncVendorKitsMock).not.toHaveBeenCalled();
  });

  it("sends a team member to /admin without syncing kits", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "t1", email: "team@merqo.io" },
      isTeam: true,
      links: [],
    });

    const res = await GET(request);

    expect(res.headers.get("location")).toBe("https://merqo.example.com/admin");
    expect(syncVendorKitsMock).not.toHaveBeenCalled();
  });

  it("force-syncs a vendor's kits and sends them to /dashboard", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "v1", email: "Vendor@Business.sg" },
      isTeam: false,
      links: [],
    });

    const res = await GET(request);

    expect(syncVendorKitsMock).toHaveBeenCalledWith("Vendor@Business.sg", {
      force: true,
    });
    expect(res.headers.get("location")).toBe(
      "https://merqo.example.com/dashboard",
    );
  });
});
