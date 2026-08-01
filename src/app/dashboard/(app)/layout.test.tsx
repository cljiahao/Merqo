// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { requireActiveVendorMock, maybeSingleMock } = vi.hoisted(() => ({
  requireActiveVendorMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return { ...actual, requireActiveVendor: requireActiveVendorMock };
});

// DashboardTour reads dashboard_prefs directly off the RLS-scoped client.
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
}));

// DashboardTour (rendered by the layout) calls next/navigation's
// usePathname/useRouter — needs a mount context this test doesn't have.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset().mockResolvedValue({ data: null });
  });

  it("links the logo to /dashboard and renders the account menu", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { id: "v1", email: "vendor@business.sg" },
      isTeam: false,
      links: [],
    });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    expect(
      screen.getByRole("link", { name: /merqo dashboard home/i }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      screen.getByRole("button", { name: "Account menu" }),
    ).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows the admin switch link for a team member", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { id: "team-1", email: "team@merqo.io" },
      isTeam: true,
      links: [],
    });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Go to admin" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("renders the DashboardTour replay button, threading dashboard_prefs.tour_seen_at as seen", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { id: "v1", email: "vendor@business.sg" },
      isTeam: false,
      links: [],
    });
    maybeSingleMock.mockResolvedValue({
      data: { tour_seen_at: "2026-08-01T00:00:00.000Z" },
    });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    expect(
      screen.getByRole("button", { name: /replay onboarding tour/i }),
    ).toBeInTheDocument();
  });
});
