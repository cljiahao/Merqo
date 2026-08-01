import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn().mockReturnValue({}),
}));

import { createClient } from "./client";
import * as supabaseSSR from "@supabase/ssr";

const createBrowserClientMock = vi.mocked(supabaseSSR.createBrowserClient);

describe("createClient — shared-session cookie domain", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    createBrowserClientMock.mockClear();
  });

  it("scopes the auth cookie to .merqo.io when NEXT_PUBLIC_AUTH_COOKIE_DOMAIN is set", () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ".merqo.io";
    createClient();
    const options = createBrowserClientMock.mock.calls[0][2] as {
      cookieOptions?: unknown;
    };
    expect(options?.cookieOptions).toEqual({ domain: ".merqo.io" });
  });

  it("omits cookieOptions.domain when NEXT_PUBLIC_AUTH_COOKIE_DOMAIN is unset (dev/preview)", () => {
    createClient();
    const options = createBrowserClientMock.mock.calls[0][2] as {
      cookieOptions?: unknown;
    };
    expect(options?.cookieOptions).toBeUndefined();
  });
});
