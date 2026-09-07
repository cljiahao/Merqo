// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
  }),
}));

import Home from "./page";

describe("Home", () => {
  it("sends a signed-in vendor's CTAs through /post-login, not straight to /admin", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@example.com" } },
    });

    render(await Home());

    for (const link of screen.getAllByRole("link", {
      name: /go to dashboard/i,
    })) {
      expect(link).toHaveAttribute("href", "/post-login");
    }
  });

  it("sends a signed-out visitor's sticky CTA to /login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    render(await Home());

    expect(
      screen.getAllByRole("link", { name: /sign in/i })[0],
    ).toHaveAttribute("href", "/login");
  });
});
