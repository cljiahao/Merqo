import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } });
  const createServerClient = vi.fn().mockReturnValue({ auth: { getUser } });
  return { getUser, createServerClient };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

// `middleware.ts` reads NEXT_PUBLIC_AUTH_COOKIE_DOMAIN into a module-level
// const at import time, so each test that varies that env var must force a
// fresh module evaluation via a post-mutation dynamic import (vi.resetModules
// does not itself re-run a static top-level import). vi.mock registrations
// survive vi.resetModules(), so the @supabase/ssr mock still applies.
async function importUpdateSession() {
  vi.resetModules();
  const mod = await import("./middleware");
  return mod.updateSession;
}

describe("updateSession — legacy host-only cookie cleanup", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    vi.clearAllMocks();
  });

  it("clears a pre-existing sb-*-auth-token cookie once when the cookie domain is enabled", async () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ".merqo.io";
    const updateSession = await importUpdateSession();
    const request = new NextRequest("https://merqo.io/dashboard", {
      headers: { cookie: "sb-project-auth-token=stale-value" },
    });

    const response = await updateSession(request);

    const setCookies = response.cookies.getAll();
    const cleared = setCookies.find((c) => c.name === "sb-project-auth-token");
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);

    const marker = setCookies.find(
      (c) => c.name === "sb-auth-cookie-domain-migrated",
    );
    expect(marker?.value).toBe("1");
  });

  it("does not clear again once the migration marker cookie is already present", async () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ".merqo.io";
    const updateSession = await importUpdateSession();
    const request = new NextRequest("https://merqo.io/dashboard", {
      headers: {
        cookie:
          "sb-project-auth-token=fresh-value; sb-auth-cookie-domain-migrated=1",
      },
    });

    const response = await updateSession(request);

    const cleared = response.cookies
      .getAll()
      .find((c) => c.name === "sb-project-auth-token");
    expect(cleared).toBeUndefined();
  });

  it("does nothing when NEXT_PUBLIC_AUTH_COOKIE_DOMAIN is unset", async () => {
    const updateSession = await importUpdateSession();
    const request = new NextRequest("https://merqo.io/dashboard", {
      headers: { cookie: "sb-project-auth-token=stale-value" },
    });

    const response = await updateSession(request);

    const cleared = response.cookies
      .getAll()
      .find((c) => c.name === "sb-project-auth-token");
    expect(cleared).toBeUndefined();
  });
});
