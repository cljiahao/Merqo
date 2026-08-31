// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { requireVendorSessionMock, maybeSingleMock, stampTourSeenMock } =
  vi.hoisted(() => ({
    requireVendorSessionMock: vi.fn(),
    maybeSingleMock: vi.fn(),
    stampTourSeenMock: vi.fn(async () => {}),
  }));

vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return { ...actual, requireVendorSession: requireVendorSessionMock };
});

vi.mock("@/lib/tour-prefs", () => ({
  stampTourSeen: stampTourSeenMock,
}));

// DashboardTour reads dashboard_prefs directly off the RLS-scoped client, and
// (since it now stamps tour-seen on mount rather than on tour completion)
// also calls markTourSeen's own auth.getUser() as soon as it auto-runs.
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
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
    stampTourSeenMock.mockClear();
  });

  it("links the logo to /dashboard and renders the account menu", async () => {
    requireVendorSessionMock.mockResolvedValue({
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
    requireVendorSessionMock.mockResolvedValue({
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
    requireVendorSessionMock.mockResolvedValue({
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

  it("durably stamps tour_seen_at during its own render when unset", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { id: "v1", email: "vendor@business.sg" },
      isTeam: false,
      links: [],
    });
    maybeSingleMock.mockResolvedValue({ data: { tour_seen_at: null } });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    expect(stampTourSeenMock).toHaveBeenCalledWith(expect.anything(), "v1");
  });

  it("durably stamps tour_seen_at when no dashboard_prefs row exists yet", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { id: "v1", email: "vendor@business.sg" },
      isTeam: false,
      links: [],
    });
    maybeSingleMock.mockResolvedValue({ data: null });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    expect(stampTourSeenMock).toHaveBeenCalledWith(expect.anything(), "v1");
  });

  it("does not re-stamp once the tour has already been seen", async () => {
    requireVendorSessionMock.mockResolvedValue({
      user: { id: "v1", email: "vendor@business.sg" },
      isTeam: false,
      links: [],
    });
    maybeSingleMock.mockResolvedValue({
      data: { tour_seen_at: "2026-08-01T00:00:00.000Z" },
    });

    const { default: DashboardLayout } = await import("./layout");
    render(await DashboardLayout({ children: <p>content</p> }));

    expect(stampTourSeenMock).not.toHaveBeenCalled();
  });
});
