// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  password: vi.fn(),
  signup: vi.fn(),
  reset: vi.fn(),
  oauth: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import LoginPage from "@/app/login/page";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.client.mockReturnValue({
    auth: {
      signInWithPassword: mocks.password,
      signUp: mocks.signup,
      resetPasswordForEmail: mocks.reset,
      signInWithOAuth: mocks.oauth,
    },
  });
});

it.each(["password", "signup", "reset"] as const)(
  "recovers from rejected %s requests and permits retry",
  async (method) => {
    const user = userEvent.setup();
    render(<LoginPage />);
    if (method === "signup")
      await user.click(
        screen.getByRole("button", { name: "Create an account" }),
      );
    await user.type(screen.getByLabelText("Email"), "vendor@example.com");
    await user.type(screen.getByLabelText("Password"), "safe-password");
    mocks[method].mockRejectedValueOnce(new Error("offline"));
    const labels = {
      password: "Sign in",
      signup: "Create account",
      reset: "Forgot password?",
    };
    const label = labels[method];
    await user.click(screen.getByRole("button", { name: label }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    expect(screen.getByRole("button", { name: label })).toBeEnabled();
    mocks[method].mockClear();
    mocks[method].mockResolvedValue({ data: { session: null }, error: null });
    await user.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(mocks[method]).toHaveBeenCalledTimes(1));
  },
);

it("recovers when browser client construction throws", async () => {
  render(<LoginPage />);
  mocks.client.mockImplementationOnce(() => {
    throw new Error("configuration unavailable");
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again",
  );
  expect(
    screen.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
});
