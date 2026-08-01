// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { requireActiveVendorMock } = vi.hoisted(() => ({
  requireActiveVendorMock: vi.fn(),
}));

vi.mock("@/lib/vendor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor")>();
  return { ...actual, requireActiveVendor: requireActiveVendorMock };
});

describe("DashboardLayout", () => {
  it("links the logo to /dashboard and renders the account menu", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
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
      user: { email: "team@merqo.io" },
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
});
