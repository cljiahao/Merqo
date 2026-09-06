// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
  }),
}));

import AboutPage from "./page";

describe("AboutPage", () => {
  it("renders the founder note and a link back to the kit family", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    render(await AboutPage());

    expect(screen.getByText("Why Merqo")).toBeInTheDocument();
    expect(
      screen.getByText(/wedding, in the queue for a coffee cart/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the kits" })).toHaveAttribute(
      "href",
      "/#kits",
    );
  });

  it("shows the dashboard nav CTA for a signed-in vendor", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@example.com" } },
    });

    render(await AboutPage());

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
