// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("sends a signed-out visitor to /login", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("sends a signed-in vendor through /post-login, not straight to /admin", () => {
    render(<Hero authed />);
    expect(
      screen.getByRole("link", { name: /go to dashboard/i }),
    ).toHaveAttribute("href", "/post-login");
  });
});
