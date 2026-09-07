// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./nav";

describe("Nav", () => {
  it("renders the sticky header matching qkit's px-5 py-4 sizing", () => {
    render(<Nav />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("px-5", "py-4", "backdrop-blur-md");
    expect(screen.getByText("Merqo home")).toBeInTheDocument();
  });

  it("links to the About page", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("sends a signed-in vendor through /post-login, not straight to /admin", () => {
    render(<Nav authed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/post-login",
    );
  });

  it("sends a signed-out visitor to /login", () => {
    render(<Nav authed={false} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
