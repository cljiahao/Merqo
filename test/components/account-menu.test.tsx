// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { initials, AccountMenu } from "@/components/account-menu";

describe("initials", () => {
  it("returns the uppercased first character of an email", () => {
    expect(initials("alice@example.com")).toBe("A");
  });

  it("returns • for null", () => {
    expect(initials(null)).toBe("•");
  });

  it("returns • for undefined", () => {
    expect(initials(undefined)).toBe("•");
  });

  it("returns • for an empty string", () => {
    expect(initials("")).toBe("•");
  });
});

describe("AccountMenu", () => {
  it("shows the avatar initial and the full email on the trigger", () => {
    render(<AccountMenu email="vendor@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("V");
    expect(trigger).toHaveTextContent("vendor@example.com");
  });

  it("shows only the • avatar and no email text when email is absent", () => {
    render(<AccountMenu email={null} />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("•");
    expect(screen.queryByText("@")).not.toBeInTheDocument();
  });

  it("shows the switch link when switchTo is provided", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        switchTo={{ href: "/admin", label: "Go to admin" }}
      />,
    );
    // Radix mounts DropdownMenuContent lazily — open the menu the same way a
    // user would (pointerdown on the trigger) before asserting on its items.
    // The rendered <a> carries Radix's role="menuitem" (menu-item semantics
    // take precedence over the implicit "link" role), so query by that role
    // and assert the underlying href to confirm it is a real navigable link.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    const link = screen.getByRole("menuitem", { name: "Go to admin" });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("shows no switch link when switchTo is absent", () => {
    const { container } = render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("renders an image avatar when avatarUrl is provided", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        avatarUrl="https://lh3.googleusercontent.com/a/pic.jpg"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Account menu" });
    const img = screen.getByAltText("Profile picture");
    expect(trigger).toContainElement(img);
    expect(img).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/pic.jpg",
    );
  });

  it("falls back to initials when avatarUrl is absent", () => {
    render(<AccountMenu email="vendor@example.com" />);
    expect(screen.queryByAltText("Profile picture")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account menu" }),
    ).toHaveTextContent("V");
  });

  it("always shows a Profile link", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("opens the Feedback sheet when its menu item is selected, and Contact Merqo is gone", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.queryByRole("menuitem", { name: "Contact Merqo" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Feedback" }));
    expect(
      screen.getByText(/how's merqo working for you/i),
    ).toBeInTheDocument();
  });

  it("opens the Report a problem sheet when its menu item is selected", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Report a problem" }));
    expect(
      screen.getByText(/something not working, or need help/i),
    ).toBeInTheDocument();
  });

  it("hides the Get help submenu when there are no active kits, but keeps Feedback and Report a problem", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.queryByRole("menuitem", { name: "Get help" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Report a problem" }),
    ).toBeInTheDocument();
  });

  it("lists each active kit's support link inside Get help", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        activeKits={[
          { slug: "qkit", name: "qkit", href: "https://qkit-sg.vercel.app" },
        ]}
      />,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Get help" }));
    expect(
      screen.getByRole("menuitem", { name: "qkit support" }),
    ).toHaveAttribute("href", "https://qkit-sg.vercel.app/dashboard");
  });
});
