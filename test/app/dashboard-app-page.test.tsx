// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { requireActiveVendorMock, syncVendorKitsMock, listLiveProductsMock } =
  vi.hoisted(() => ({
    requireActiveVendorMock: vi.fn(),
    syncVendorKitsMock: vi.fn(),
    listLiveProductsMock: vi.fn(),
  }));

vi.mock("@/lib/vendor", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/vendor")>("@/lib/vendor");
  return { ...actual, requireActiveVendor: requireActiveVendorMock };
});
vi.mock("@/lib/vendor-sync", () => ({ syncVendorKits: syncVendorKitsMock }));
vi.mock("@/lib/products", () => ({ listLiveProducts: listLiveProductsMock }));
vi.mock("@/components/dashboard/activate-kits-button", () => ({
  ActivateKitsButton: ({
    slugs,
    label,
  }: {
    slugs: string[];
    label: string;
  }) => (
    <div data-testid={`activate-kits-button-${slugs.join("-")}`}>{label}</div>
  ),
}));

import DashboardPage from "@/app/dashboard/(app)/page";

describe("DashboardPage — provisionable (readyToAdd) kits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes paykit (kits.ts-live but no provisioning capability) from Ready to add, keeps qkit/loopkit", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);
    // Same real-world drift as the pending-page test: paykit is display-live
    // in kits.ts but has no provision_secret in the live registry.
    listLiveProductsMock.mockResolvedValue([
      {
        slug: "qkit",
        name: "qkit",
        app_url: "https://qkit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: "p1",
      },
      {
        slug: "loopkit",
        name: "loopkit",
        app_url: "https://loopkit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: "p2",
      },
      {
        slug: "paykit",
        name: "paykit",
        app_url: "https://paykit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: null,
      },
    ]);

    const jsx = await DashboardPage();
    render(jsx);

    // qkit is already active (linked), so it's never in "ready to add" —
    // loopkit (live + provisionable + not linked) must render its own
    // per-kit activate button; paykit must not.
    expect(
      screen.getByTestId("activate-kits-button-loopkit"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("activate-kits-button-paykit"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("paykit")).not.toBeInTheDocument();
  });
});
