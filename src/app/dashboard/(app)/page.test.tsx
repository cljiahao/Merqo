// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireActiveVendorMock, syncVendorKitsMock } = vi.hoisted(() => ({
  requireActiveVendorMock: vi.fn(),
  syncVendorKitsMock: vi.fn(),
}));

vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return {
    ...actual,
    requireActiveVendor: requireActiveVendorMock,
  };
});

vi.mock("@/lib/vendor-sync", () => ({
  syncVendorKits: syncVendorKitsMock,
}));

// ActivateKitsButton (rendered for every "Ready to add" kit) calls
// next/navigation's useRouter — needs a mount context this test doesn't have.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    requireActiveVendorMock.mockReset();
    syncVendorKitsMock.mockReset();
  });

  it("re-syncs vendor kits on load so a kit added elsewhere shows up without a fresh login", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });
    // The vendor signed up on paykit directly — merqo's own vendor_links
    // row doesn't know about it yet until a sync runs.
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "paykit", status: "active", plan: "free" },
    ]);

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    expect(syncVendorKitsMock).toHaveBeenCalledWith("vendor@business.sg");
    expect(screen.getByText("paykit")).toBeInTheDocument();
    expect(
      screen.queryByText("Add paykit", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("still renders when the vendor has no email (never syncs)", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: null },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    expect(syncVendorKitsMock).not.toHaveBeenCalled();
    expect(screen.getByText("qkit")).toBeInTheDocument();
  });
});
