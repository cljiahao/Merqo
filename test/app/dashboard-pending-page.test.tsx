// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { loadVendorContextMock, syncVendorKitsMock, listLiveProductsMock } =
  vi.hoisted(() => ({
    loadVendorContextMock: vi.fn(),
    syncVendorKitsMock: vi.fn(),
    listLiveProductsMock: vi.fn(),
  }));

vi.mock("@/lib/vendor", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/vendor")>("@/lib/vendor");
  return { ...actual, loadVendorContext: loadVendorContextMock };
});
vi.mock("@/lib/vendor-sync", () => ({ syncVendorKits: syncVendorKitsMock }));
vi.mock("@/lib/products", () => ({ listLiveProducts: listLiveProductsMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/dashboard/activate-kits-button", () => ({
  ActivateKitsButton: ({
    slugs,
    label,
  }: {
    slugs: string[];
    label: string;
  }) => (
    <div data-testid="activate-kits-button" data-slugs={slugs.join(",")}>
      {label}
    </div>
  ),
}));

import PendingPage from "@/app/dashboard/pending/page";

describe("PendingPage — provisionable (addable) kits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes paykit (kits.ts-live but no provisioning capability), keeps qkit/loopkit", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [],
    });
    syncVendorKitsMock.mockResolvedValue([]);
    // Mirrors the real merqo.products state this bug was found from: paykit
    // has no provision_secret/route yet, despite kits.ts marking it "live".
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

    const jsx = await PendingPage();
    render(jsx);

    const button = screen.getByTestId("activate-kits-button");
    const slugs = button.dataset.slugs?.split(",") ?? [];
    expect(slugs).toContain("qkit");
    expect(slugs).toContain("loopkit");
    expect(slugs).not.toContain("paykit");
    expect(button.textContent).toBe("Activate all my kits");
  });

  it("falls back to an external login link when addable kits exist but none are provisionable", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [
        { product_slug: "qkit", status: "active", plan: "free" },
        { product_slug: "loopkit", status: "active", plan: "free" },
      ],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "loopkit", status: "active", plan: "free" },
    ]);
    // Only paykit is addable (qkit/loopkit already active), and paykit has
    // no provision_secret — the provisionable subset is empty even though
    // addableKits(links) is not.
    listLiveProductsMock.mockResolvedValue([
      {
        slug: "paykit",
        name: "paykit",
        app_url: "https://paykit.vercel.app",
        metrics_url: null,
        metrics_secret: null,
        provision_secret: null,
      },
    ]);

    const jsx = await PendingPage();
    render(jsx);

    expect(
      screen.queryByTestId("activate-kits-button"),
    ).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Add paykit" });
    expect(link).toHaveAttribute("href", "https://paykit-sg.vercel.app/login");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("re-syncs when the vendor's only link is needs_setup, so finishing paykit setup is picked up without a fresh login", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [{ product_slug: "paykit", status: "needs_setup", plan: "free" }],
    });
    // Vendor just finished real payment setup on paykit's own dashboard —
    // merqo's vendor_links row still says needs_setup until this re-sync.
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "paykit", status: "active", plan: "free" },
    ]);
    listLiveProductsMock.mockResolvedValue([]);

    await PendingPage();

    expect(syncVendorKitsMock).toHaveBeenCalledWith("v@x.com");
  });

  it("renders 'Almost there' (not 'No kits yet') for a vendor whose only link is needs_setup, with a Finish setup deep-link", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [{ product_slug: "paykit", status: "needs_setup", plan: null }],
    });
    // Re-sync runs (needs_setup triggers it) but the vendor hasn't actually
    // finished setup yet, so it comes back unchanged.
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    listLiveProductsMock.mockResolvedValue([]);

    const jsx = await PendingPage();
    render(jsx);

    expect(
      screen.getByRole("heading", { name: "Almost there" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No kits yet")).not.toBeInTheDocument();
    expect(screen.getByText("paykit", { exact: false })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Finish setup" });
    expect(link).toHaveAttribute(
      "href",
      "https://paykit-sg.vercel.app/dashboard/config",
    );
  });

  it("renders both the pending (waitlist) list and the needs-setup list together", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [
        { product_slug: "loopkit", status: "waitlist", plan: null },
        { product_slug: "paykit", status: "needs_setup", plan: null },
      ],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "loopkit", status: "waitlist", plan: null },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    listLiveProductsMock.mockResolvedValue([]);

    const jsx = await PendingPage();
    render(jsx);

    // pending.length > 0 wins the heading ternary even with a needs_setup
    // link also present.
    expect(
      screen.getByRole("heading", { name: "You’re on the list" }),
    ).toBeInTheDocument();
    expect(screen.getByText("loopkit")).toBeInTheDocument();
    expect(screen.getByText("paykit", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish setup" })).toHaveAttribute(
      "href",
      "https://paykit-sg.vercel.app/dashboard/config",
    );
  });

  it("still renders 'No kits yet' for a vendor with zero links at all", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [],
    });
    syncVendorKitsMock.mockResolvedValue([]);
    listLiveProductsMock.mockResolvedValue([]);

    const jsx = await PendingPage();
    render(jsx);

    expect(screen.getByText("No kits yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Almost there" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "You’re on the list" }),
    ).not.toBeInTheDocument();
  });

  it("degrades to no addable kits (no activate button) instead of crashing when listLiveProducts throws", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      isTeam: false,
      links: [],
    });
    syncVendorKitsMock.mockResolvedValue([]);
    listLiveProductsMock.mockRejectedValue(new Error("products read failed"));

    const jsx = await PendingPage();
    render(jsx);

    expect(
      screen.queryByTestId("activate-kits-button"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No kits yet")).toBeInTheDocument();
  });
});
