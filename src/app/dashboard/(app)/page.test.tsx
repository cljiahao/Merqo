// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireActiveVendorMock,
  syncVendorKitsMock,
  listLiveProductsMock,
  fetchVendorMetricsMock,
} = vi.hoisted(() => ({
  requireActiveVendorMock: vi.fn(),
  syncVendorKitsMock: vi.fn(),
  listLiveProductsMock: vi.fn(),
  fetchVendorMetricsMock: vi.fn(),
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

vi.mock("@/lib/products", () => ({
  listLiveProducts: listLiveProductsMock,
}));

vi.mock("@/lib/vendor-metrics-client", () => ({
  fetchVendorMetrics: fetchVendorMetricsMock,
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
    listLiveProductsMock.mockReset();
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
    ]);
    fetchVendorMetricsMock
      .mockReset()
      .mockImplementation(async (kit: { slug: string }) => ({
        ok: false,
        slug: kit.slug,
      }));
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

  it("still renders when the vendor has no email (never syncs or fetches metrics)", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: null },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    expect(syncVendorKitsMock).not.toHaveBeenCalled();
    expect(fetchVendorMetricsMock).not.toHaveBeenCalled();
    expect(screen.getByText("qkit")).toBeInTheDocument();
  });

  it("shows a Finish setup section for a needs_setup kit", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [
        { product_slug: "qkit", status: "active", plan: "free" },
        { product_slug: "paykit", status: "needs_setup", plan: null },
      ],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    // NOTE: deviates from the brief's verbatim `getByText("Finish setup")`
    // assertion here — the section heading and the CTA link both render the
    // literal text "Finish setup" (per the brief's own JSX), so a plain
    // getByText match is ambiguous (throws "Found multiple elements").
    // Asserting the heading by role disambiguates while preserving intent;
    // see task-9-report.md for detail.
    expect(
      screen.getByRole("heading", { name: "Finish setup" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish setup" })).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/config"),
    );
  });

  it("states how many of the live kits the vendor has connected", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);

    const { default: DashboardPage } = await import("./page");
    const { LIVE_KITS } = await import("@/lib/kits");
    render(await DashboardPage());

    expect(
      screen.getByText(`1 of ${LIVE_KITS.length} kits connected`, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("fetches and renders real vendor metrics for an active kit found in the registry", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);
    listLiveProductsMock.mockResolvedValue([
      {
        slug: "qkit",
        name: "qkit",
        app_url: "https://qkit-sg.vercel.app",
        metrics_url: null,
        metrics_secret: "s",
      },
    ]);
    fetchVendorMetricsMock.mockResolvedValue({
      ok: true,
      slug: "qkit",
      data: {
        product: "qkit",
        generated_at: "2026-07-26T00:00:00.000Z",
        metrics: [{ key: "orders_7d", label: "Orders (7d)", value: "42" }],
      },
    });

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    expect(fetchVendorMetricsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "qkit",
        app_url: "https://qkit-sg.vercel.app",
      }),
      "vendor@business.sg",
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Orders (7d)")).toBeInTheDocument();
  });
});
