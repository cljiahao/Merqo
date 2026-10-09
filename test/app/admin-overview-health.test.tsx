import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  team: vi.fn(),
  products: vi.fn(),
  grants: vi.fn(),
  support: vi.fn(),
  metrics: vi.fn(),
}));
vi.mock("@/lib/team", () => ({ requireMerqoTeam: mocks.team }));
vi.mock("@/lib/products", () => ({ listLiveProducts: mocks.products }));
vi.mock("@/lib/admin", () => ({ listVendorGrants: mocks.grants }));
vi.mock("@/lib/support", () => ({ listOpenSupportMessages: mocks.support }));
vi.mock("@/lib/metrics-client", () => ({ fetchProductMetrics: mocks.metrics }));
vi.mock("@/lib/billing-settings", () => ({
  getBillingSettings: async () => ({ bundle_discount_enabled: true }),
}));
vi.mock("@/app/admin/bundle-discount-toggle", () => ({
  BundleDiscountToggle: () => <span>Bundle discount</span>,
}));
vi.mock("@/app/admin/support-message-row", () => ({
  SupportMessageRow: () => <span>Support request</span>,
}));
import Overview from "@/app/admin/page";
import Products from "@/app/admin/products/page";
import { StatusBanner } from "@/app/admin/status-banner";
const product = { slug: "qkit", name: "Queue Kit" };
function reporting(pending = 1, generated = new Date().toISOString()) {
  return {
    ok: true,
    product: "qkit",
    durationMs: 25,
    data: {
      product: "qkit",
      generated_at: generated,
      revenue_cents_all: 25000,
      revenue_cents_30d: 15000,
      gmv_cents_30d: 30000,
      active_vendors: 4,
      orders_7d: 6,
      orders_prev_7d: 3,
      signups_7d: 2,
      pro_vendors: 2,
      total_vendors: 5,
      pending_upgrade_requests: pending,
      funnel: { signed_up: 5, with_booth: 4, with_order: 3, pro: 2 },
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.team.mockResolvedValue({ user: { id: "operator" } });
  mocks.products.mockResolvedValue([product]);
  mocks.grants.mockResolvedValue([]);
  mocks.support.mockResolvedValue([]);
  mocks.metrics.mockResolvedValue(reporting());
});
it("shows attention requests alongside reporting totals", async () => {
  mocks.grants.mockResolvedValue([
    {
      email: "waiting@example.com",
      kits: [
        { slug: "qkit", status: "waitlist" },
        { slug: "loopkit", status: "active" },
      ],
    },
  ]);
  mocks.support.mockResolvedValue([{ id: "support" }]);
  const html = renderToStaticMarkup(await Overview());
  expect(html).toContain("waiting@example.com");
  expect(html).toContain("Support request");
  expect(html).toContain("upgrade request");
  expect(html).toContain("Revenue (all)");
});
it("shows plural upgrades and stale metrics", async () => {
  mocks.metrics.mockResolvedValue(reporting(2, "2000-01-01T00:00:00Z"));
  const html = renderToStaticMarkup(await Overview());
  expect(html).toContain("upgrade requests");
  expect(html).toContain("lagging");
});
it("explains total outage instead of displaying misleading zero totals", async () => {
  mocks.metrics.mockResolvedValue({
    ok: false,
    product: "qkit",
    durationMs: 10,
    reason: "unreachable",
  });
  const html = renderToStaticMarkup(await Overview());
  expect(html).toContain("Metrics unavailable");
  expect(html).not.toContain("Revenue (all)");
  expect(html).not.toContain("Needs attention");
});
it("handles an empty product registry", async () => {
  mocks.products.mockResolvedValue([]);
  expect(renderToStaticMarkup(await Overview())).toContain(
    "No products registered yet",
  );
  expect(renderToStaticMarkup(await Products())).toContain(
    "No live products registered yet",
  );
  expect(mocks.metrics).not.toHaveBeenCalled();
});
it("does not read dashboard data when authorization fails", async () => {
  mocks.team.mockRejectedValue(new Error("not authorized"));
  await expect(Overview()).rejects.toThrow("not authorized");
  expect(mocks.products).not.toHaveBeenCalled();
});
it("renders product health and latency for reporting and failed kits", async () => {
  let html = renderToStaticMarkup(await Products());
  expect(html).toContain("Reporting");
  expect(html).toContain("25 ms");
  mocks.metrics.mockResolvedValue({
    ok: false,
    product: "qkit",
    durationMs: 5000,
    reason: "unreachable",
  });
  html = renderToStaticMarkup(await Products());
  expect(html).toContain("Down");
  expect(html).toContain("5000 ms");
});
it("includes stale and down counts in a mixed health banner", () => {
  expect(
    renderToStaticMarkup(<StatusBanner reporting={2} lagging={1} down={1} />),
  ).toContain("1 lagging");
});
