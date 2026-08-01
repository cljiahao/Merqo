import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

// All operator areas require a session. Everything else (landing, /login,
// /no-access) is public. Merqo-team membership and vendor-active status are
// additionally enforced in each page via requireMerqoTeam() / requireActiveVendor();
// the proxy only guarantees a session.
function isProtectedPath(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/dashboard");
}

const AUTH_COOKIE_DOMAIN = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
const MIGRATION_MARKER = "sb-auth-cookie-domain-migrated";

// One-time cleanup after enabling the shared .merqo.io cookie domain: a
// vendor already signed in has a HOST-ONLY Supabase auth cookie from before
// this change. Once this kit starts writing a Domain=.merqo.io cookie of the
// same name, both can exist in the jar at once, and the browser's cookie
// parser and Next's disagree on which same-named cookie wins (RFC 6265
// ordering ambiguity) — which can replay an already-used refresh token and
// trip Supabase's reuse detection. Clearing the host-only cookie once (no
// Domain attribute, so it can't touch the new domain-scoped one) forces a
// one-time re-login instead. Guarded by a host-only marker cookie so it
// fires once per browser per kit; no-op once AUTH_COOKIE_DOMAIN is unset.
function clearLegacyHostOnlyCookie(
  request: NextRequest,
  response: NextResponse,
) {
  if (!AUTH_COOKIE_DOMAIN || request.cookies.get(MIGRATION_MARKER)) return;
  request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .forEach((c) => response.cookies.set(c.name, "", { path: "/", maxAge: 0 }));
  response.cookies.set(MIGRATION_MARKER, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
      cookieOptions: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
        ? { domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN }
        : undefined,
    },
  );

  // Refresh the session on EVERY request, not just protected ones. @supabase/ssr
  // rotates the auth cookies as a side effect of getUser(); skipping it on public
  // routes (the landing, /login) lets the access token age out with no refresh,
  // which silently logs the user out when they return. Run getUser() first, then
  // apply the login gate only for protected paths.
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth unreachable — degrade to unauthenticated.
    user = null;
  }

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    clearLegacyHostOnlyCookie(request, redirectResponse);
    return redirectResponse;
  }

  clearLegacyHostOnlyCookie(request, supabaseResponse);
  return supabaseResponse;
}
