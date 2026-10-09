import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: mocks.create }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.create.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchange },
  });
});
it("rejects missing codes without opening an auth client", async () => {
  const res = await GET(new Request("https://merqo.example/auth/callback"));
  expect(res.headers.get("location")).toBe(
    "https://merqo.example/login?error=oauth",
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each([undefined, "https://evil.example", "//evil.example", "relative"])(
  "rejects unsafe or missing redirect target %s",
  async (next) => {
    const url = new URL("https://merqo.example/auth/callback?code=code");
    if (next !== undefined) url.searchParams.set("next", next);
    const res = await GET(new Request(url));
    expect(res.headers.get("location")).toBe(
      "https://merqo.example/post-login",
    );
  },
);
it("preserves the recovery path after successful exchange", async () => {
  const res = await GET(
    new Request(
      "https://merqo.example/auth/callback?code=recovery&next=/reset-password",
    ),
  );
  expect(res.headers.get("location")).toBe(
    "https://merqo.example/reset-password",
  );
  expect(mocks.exchange).toHaveBeenCalledWith("recovery");
});
it("rejects an unsuccessful code exchange", async () => {
  mocks.exchange.mockResolvedValue({ error: { message: "invalid code" } });
  const res = await GET(
    new Request("https://merqo.example/auth/callback?code=invalid"),
  );
  expect(res.headers.get("location")).toBe(
    "https://merqo.example/login?error=oauth",
  );
});
