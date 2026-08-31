// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const {
  requireVendorSessionMock,
  syncVendorKitsMock,
  listLiveProductsMock,
  fetchVendorMetricsMock,
} = vi.hoisted(() => ({
  requireVendorSessionMock: vi.fn(),
  syncVendorKitsMock: vi.fn(),
  listLiveProductsMock: vi.fn(),
  fetchVendorMetricsMock: vi.fn(),
}));

vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return {
    ...actual,
    requireVendorSession: requireVendorSessionMock,
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
    requireVendorSessionMock.mockReset();
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
    requireVendorSessionMock.mockResolvedValue({
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
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

    expect(syncVendorKitsMock).toHaveBeenCalledWith("vendor@business.sg");
    expect(screen.getByText("paykit")).toBeInTheDocument();
    expect(
      screen.queryByText("Add paykit", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("still renders when the vendor has no email (never syncs or fetches metrics)", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { email: null },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });

    const { default: DashboardPage } = await import("./page");
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

    expect(syncVendorKitsMock).not.toHaveBeenCalled();
    expect(fetchVendorMetricsMock).not.toHaveBeenCalled();
    expect(screen.getByText("qkit")).toBeInTheDocument();
  });

  it("shows a Needs your attention section for a needs_setup kit", async () => {
    requireVendorSessionMock.mockResolvedValue({
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
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

    // The old standalone "Finish setup" section heading was merged into a
    // single urgency-ordered "Needs your attention" band; the CTA link inside
    // it still reads "Finish setup".
    expect(
      screen.getByRole("heading", { name: "Needs your attention · 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish setup" })).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/config"),
    );
  });

  it("states how many of the live kits the vendor has connected", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
    ]);

    const { default: DashboardPage } = await import("./page");
    const { LIVE_KITS } = await import("@/lib/kits");
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

    expect(
      screen.getByText(`1 of ${LIVE_KITS.length} kits connected`, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("fetches and renders real vendor metrics for an active kit found in the registry", async () => {
    requireVendorSessionMock.mockResolvedValue({
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
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

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

  it("shows a pick-a-kit hero (not the overview) for a signed-in user with no kits", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { email: "buyer@business.sg" },
      isTeam: false,
      links: [],
    });
    syncVendorKitsMock.mockResolvedValue([]);

    const { default: DashboardPage } = await import("./page");
    render(<TooltipProvider>{await DashboardPage()}</TooltipProvider>);

    expect(
      screen.getByRole("heading", { name: "Pick a kit to get started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate all my kits" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("kits connected", { exact: false }),
    ).not.toBeInTheDocument();
  });
});
