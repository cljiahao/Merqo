// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInWithOAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a) },
  }),
}));

import LoginPage from "@/app/login/page";

describe("LoginPage — Google sign-in", () => {
  it("requests an English-locale OAuth consent screen", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({ queryParams: { hl: "en" } }),
    });
  });

  it("shows the error message when the provider call fails early", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "boom" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
