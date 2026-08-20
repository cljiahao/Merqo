// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireMerqoTeamMock, hasActiveVendorAccessMock, getAvatarUrlMock } =
  vi.hoisted(() => ({
    requireMerqoTeamMock: vi.fn(),
    hasActiveVendorAccessMock: vi.fn(),
    getAvatarUrlMock: vi.fn(),
  }));

vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));
vi.mock("@/lib/vendor", () => ({
  hasActiveVendorAccess: hasActiveVendorAccessMock,
}));
vi.mock("@/lib/account", () => ({
  getAvatarUrl: getAvatarUrlMock,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

describe("AdminLayout", () => {
  beforeEach(() => {
    requireMerqoTeamMock.mockReset();
    hasActiveVendorAccessMock.mockReset();
    getAvatarUrlMock.mockReset().mockReturnValue(null);
  });

  it("threads the signed-in user's email/avatar and an active-vendor canSwitch into AdminNav, and renders children", async () => {
    requireMerqoTeamMock.mockResolvedValue({
      user: { email: "team@merqo.io", user_metadata: {} },
    });
    hasActiveVendorAccessMock.mockResolvedValue(true);
    getAvatarUrlMock.mockReturnValue("https://x.supabase.co/avatar.png");

    const { default: AdminLayout } = await import("./layout");
    const { getByText, container } = render(
      await AdminLayout({ children: <div>page content</div> }),
    );

    expect(hasActiveVendorAccessMock).toHaveBeenCalledWith("team@merqo.io");
    expect(getByText("page content")).toBeInTheDocument();
    expect(getByText("team@merqo.io")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://x.supabase.co/avatar.png",
    );
  });

  it("skips the active-vendor-access lookup and forces canSwitch=false when the user has no email", async () => {
    requireMerqoTeamMock.mockResolvedValue({
      user: { email: null, user_metadata: {} },
    });

    const { default: AdminLayout } = await import("./layout");
    const { getByText } = render(
      await AdminLayout({ children: <div>page content</div> }),
    );

    expect(hasActiveVendorAccessMock).not.toHaveBeenCalled();
    expect(getByText("page content")).toBeInTheDocument();
    // No email means AccountMenu's trigger falls back to the "•" initials
    // placeholder instead of rendering an email span.
    expect(getByText("•")).toBeInTheDocument();
  });
});
