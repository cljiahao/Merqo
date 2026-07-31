// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/admin"),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

import { AdminNav } from "./admin-nav";

const TABS = [
  { label: "Overview", href: "/admin" },
  { label: "Vendors", href: "/admin/vendors" },
  { label: "Products", href: "/admin/products" },
  { label: "Team", href: "/admin/team" },
  { label: "Feedback", href: "/admin/feedback" },
];

describe("AdminNav", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/admin");
  });

  it("renders a closed burger button, hidden at sm and up", () => {
    render(<AdminNav canSwitch={false} />);
    const burger = screen.getByRole("button", { name: "Open menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(burger.className).toMatch(/sm:hidden/);
  });

  it("opens the mobile panel and flips to Close menu when the burger is clicked", () => {
    render(<AdminNav canSwitch={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const closeButton = screen.getByRole("button", { name: "Close menu" });
    expect(closeButton).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the mobile panel when the burger is clicked again", () => {
    render(<AdminNav canSwitch={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    const burger = screen.getByRole("button", { name: "Open menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile panel when a tab link inside it is clicked", () => {
    render(<AdminNav canSwitch={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const vendorsLinks = screen.getAllByRole("link", { name: "Vendors" });
    // Two "Vendors" links exist while the panel is open (mobile + desktop);
    // the mobile one (inside the header, with the closing onClick) renders
    // first in DOM order — the desktop <nav> is a later sibling.
    fireEvent.click(vendorsLinks[0]);

    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Vendors" }).length).toBe(1);
  });

  it("closes the mobile panel when the backdrop behind it is clicked", () => {
    render(<AdminNav canSwitch={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const backdrop = document.querySelector('button[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("lists the same tabs in the mobile panel as the desktop nav, with matching hrefs", () => {
    render(<AdminNav canSwitch={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    for (const tab of TABS) {
      const links = screen.getAllByRole("link", { name: tab.label });
      expect(links.length).toBe(2);
      links.forEach((link) => expect(link).toHaveAttribute("href", tab.href));
    }
  });

  it("highlights Overview as active on the exact /admin path", () => {
    pathnameMock.mockReturnValue("/admin");
    render(<AdminNav canSwitch={false} />);

    // Active tabs get the `bg-secondary text-foreground` pair; inactive tabs
    // get `text-muted-foreground hover:bg-secondary` — `bg-secondary` alone
    // is ambiguous (it's a substring of `hover:bg-secondary`), so assert on
    // `text-foreground` vs `text-muted-foreground` instead.
    expect(screen.getByRole("link", { name: "Overview" }).className).toMatch(
      /\btext-foreground\b/,
    );
    expect(screen.getByRole("link", { name: "Vendors" }).className).toMatch(
      /\btext-muted-foreground\b/,
    );
  });

  it("highlights Vendors as active via prefix match on a nested vendor route, not Overview", () => {
    pathnameMock.mockReturnValue("/admin/vendors/someone@example.com");
    render(<AdminNav canSwitch={false} />);

    expect(screen.getByRole("link", { name: "Vendors" }).className).toMatch(
      /\btext-foreground\b/,
    );
    expect(screen.getByRole("link", { name: "Overview" }).className).toMatch(
      /\btext-muted-foreground\b/,
    );
  });

  it("renders the account-menu trigger with the signed-in email", () => {
    render(<AdminNav canSwitch={false} email="team@merqo.io" />);
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("team@merqo.io")).toBeInTheDocument();
  });
});
