# supabase

## Purpose

The Supabase client factories for each execution context — browser, server
(Server Components/Actions, `merqo` schema), and middleware — plus the
one-time cleanup that lets a signed-in vendor's session carry across every
Merqo kit once auth cookies are scoped to the shared `.merqo.io` domain.

## Contents

- `client.ts` — `createClient()`: browser Supabase client
  (`createBrowserClient` from `@supabase/ssr`). Passes
  `cookieOptions: { domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN }`
  when that env var is set (Vercel Production only — unset in dev/preview,
  where it would break login rather than just fail to share it).
- `server.ts` — `createServerClient()`: cookie-backed server client
  (`db: { schema: "merqo" }`), same conditional `cookieOptions.domain` as
  `client.ts`. `createServiceClient()`: the secret-key, RLS-bypassing
  client — an empty cookie adapter (attaching request cookies would
  silently re-authenticate every query as the calling user), so
  `cookieOptions` is irrelevant there and intentionally omitted.
- `middleware.ts` — `updateSession(request)`: refreshes the session cookie
  on every request, redirecting unauthenticated requests to `/login` for
  `/admin`/`/dashboard`. Also runs `clearLegacyHostOnlyCookie()`: a vendor
  signed in before the `.merqo.io` cookie domain shipped has a HOST-ONLY
  version of the same-named auth cookie; once both exist, the browser and
  Next's cookie parser can disagree on which one wins (RFC 6265 ordering
  ambiguity), which can replay an already-used refresh token and get
  Supabase to revoke the session. The helper clears the host-only cookie
  once per browser (guarded by a `sb-auth-cookie-domain-migrated` marker
  cookie), skipping any cookie name `@supabase/ssr`'s own `setAll` just
  wrote this same request (a token refresh) so it never clobbers a fresh
  write — an incomplete pass withholds the marker and retries on the
  vendor's next request instead of losing a session.

## Connectivity

`server.ts`'s `createServerClient` is the base every server-side Supabase
read/write in this app builds on. `middleware.ts`'s `updateSession` is
called on every request (session refresh + the login gate). `client.ts` is
used by client components that need a live Supabase client (e.g. the login
page's `signInWithOAuth`/`signInWithPassword` calls).

## Parent

This is the only nested `README.md` in this repo — see the root
[README](../../../README.md) for the app overview.
