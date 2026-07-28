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
});
