import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret-test");
  vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", "");
  mocks.cookies.mockResolvedValue({ getAll: mocks.getAll, set: mocks.set });
  mocks.getAll.mockReturnValue([{ name: "session", value: "user-test" }]);
  mocks.set.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("adapts request cookies and uses the merqo schema", async () => {
  await createServerClient();
  const options = mocks.create.mock.calls[0][2];
  expect(options.db).toEqual({ schema: "merqo" });
  expect(options.cookieOptions).toBeUndefined();
  expect(options.cookies.getAll()).toEqual([
    { name: "session", value: "user-test" },
  ]);
  options.cookies.setAll([
    { name: "session", value: "new", options: { httpOnly: true } },
  ]);
  expect(mocks.set).toHaveBeenCalledWith("session", "new", { httpOnly: true });
});
it("supports shared production cookie domains and read-only component stores", async () => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", ".merqo.io");
  mocks.set.mockImplementation(() => {
    throw new Error("read only");
  });
  await createServerClient();
  const options = mocks.create.mock.calls[0][2];
  expect(options.cookieOptions).toEqual({ domain: ".merqo.io" });
  expect(() =>
    options.cookies.setAll([{ name: "session", value: "new" }]),
  ).not.toThrow();
});
it("never attaches request cookies to the service-role client", async () => {
  await createServiceClient();
  expect(mocks.cookies).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls[0].slice(0, 2)).toEqual([
    "https://example.supabase.co",
    "secret-test",
  ]);
  const options = mocks.create.mock.calls[0][2];
  expect(options.cookies.getAll()).toEqual([]);
  options.cookies.setAll([{ name: "session", value: "ignored" }]);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(options.auth).toEqual({
    autoRefreshToken: false,
    persistSession: false,
  });
});
