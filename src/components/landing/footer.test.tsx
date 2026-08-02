// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";

describe("Footer", () => {
  it("renders the wordmark, tagline, copyright line, and sign-in link matching qkit's single-row layout", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Merqo home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByText("Simple tools for Singapore’s small sellers."),
    ).toBeInTheDocument();
    expect(screen.getByText("© 2026 Merqo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in →" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
