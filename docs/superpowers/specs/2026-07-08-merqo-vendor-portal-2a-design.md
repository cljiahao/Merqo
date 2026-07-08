# Merqo Vendor Portal — Phase 2a: Vendor Access + Kit-Tile Dashboard — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorm)
**Scope:** First slice of the Phase 2 vendor portal. Let a vendor log in, get
role-routed to a vendor-facing `/dashboard`, and see their active kit tiles (each
linking out to the kit's own app), with a waitlist-aware pending path for users who
have no active kit yet. Grants vendors read access to their own `vendor_links`.

## Context

Phase 1 (admin console under `/admin/*`, gated by `requireMerqoTeam()`) is merged
(`main` @ 611e29f). The approved system design reserved `/dashboard/*` for vendors
and chose a **hybrid** data strategy. This spec builds only the vendor-access
foundation + a tile dashboard — deliberately **without** the cross-kit per-vendor
numbers, so it ships a real vendor home with **no change to qkit**.

Today: login is shared and client-side (`src/app/login/page.tsx` — Google OAuth +
email/password) and redirects everyone to `/admin`; a non-team user is bounced to
`/no-access` by `requireMerqoTeam()`. The `merqo.vendor_links_own_select` RLS policy
(migration `0001`) already permits a vendor to read their own rows by JWT email, but
the `authenticated` role has **no SELECT grant** on `vendor_links`, so a vendor's
cookie client currently reads nothing. `src/lib/kits.ts` is the static kit-family
config (slug, name, tagline, status, href) — already the landing's source of truth.

## Goal

A granted vendor signs in with the email the team granted (on `/admin/vendors`) and
lands on a `/dashboard` that shows their kits and gets them into each kit in one
click. A not-yet-active user sees an honest, waitlist-aware pending page — never an
empty shell, never someone else's data.

## Non-goals (2a)

- **No per-vendor numbers / highlight strip** — that is 2b (qkit `?email=` endpoint)
  - 2c. Tiles show identity + an open-link only, no metrics.
- **No add-a-kit / unlock flow** — 2d. 2a shows current kits + a passive "more kits
  coming" hint to the landing.
- **No feedback UI** — 2e.
- **No forced onboarding wizard / vendor profile** — a granted vendor lands straight
  on tiles. Name-capture is deferred until a feature needs it.
- **No qkit change**, no new cross-schema query, no `products` grant.

## Architecture

One app, two audiences by route namespace (unchanged from the system design):
`/admin/*` = team (Phase 1), `/dashboard/*` = vendor (this slice). All vendor reads
stay within `merqo.*` via the **cookie client** (RLS-scoped) or, where a secret could
be involved, the service-role boundary — but 2a needs neither `products` nor any
secret, so the vendor path is cookie-client + RLS only.

### Role-aware routing

A shared post-login **home resolver** decides where a signed-in user goes:

- **team** (`merqo_team`) → `/admin`
- vendor with **≥1 `vendor_links` row at status `active`** → `/dashboard`
- otherwise (waitlist-only, or no links) → `/dashboard/pending`

Applied at three existing redirect points (currently hardcoded to `/admin`):
`src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, and `src/app/reset-password/page.tsx`.
`src/proxy.ts` / `middleware.ts` `isProtectedPath` extends to also protect `/dashboard`
(session required; membership/access enforced per-page).

### Gate

`src/app/dashboard/layout.tsx` gates every `/dashboard/*` route via a new
`requireActiveVendor()` helper (mirrors `requireMerqoTeam` in `src/lib/team.ts`):

- no session → `/login`
- `merqo_team` member → `/admin` (admins don't use the vendor dashboard)
- no `active` vendor_link → `/dashboard/pending`
- a config/query fault (e.g. `PGRST106`) → throw loudly (never a silent empty dashboard)
- returns `{ user, links }` (the vendor's own link rows) for pages to render

`/dashboard/pending` is **not** behind the active-vendor gate (it must be reachable by
a logged-in non-active user); it does its own `getUser()` + own-links read.

## Data model + migration (`0003_vendor_read.sql`)

No new tables. One migration:

- `grant select on merqo.vendor_links to authenticated;` — the existing
  `vendor_links_own_select` policy scopes rows to the vendor's own email, so this
  grant exposes only the caller's own links. Safe: `vendor_links` has **no secret
  column** (`metrics_secret` lives on `products`, which stays un-granted).
- Harden `vendor_links_own_select` to compare
  `lower(email) = lower((select auth.jwt() ->> 'email'))` (team branch unchanged).
  Stored emails are already lowercased by `grantKit`, but lowering both sides removes
  any case-mismatch risk between the JWT email and the stored email.

Tile **display** data (name, tagline, open-link) is read from the static
`src/lib/kits.ts` `KITS` array by `slug` — no DB read for product metadata, so no
`products` grant is needed and `metrics_secret` never touches a vendor path.

## Components

**New:**

- `src/lib/vendor.ts` — `requireActiveVendor()` (gate, returns `{ user, links }`),
  plus pure helpers: `resolveHome(input) → "/admin" | "/dashboard" | "/dashboard/pending"`
  and `tilesForLinks(links) → { active: KitTile[]; pending: KitTile[] }` mapping
  `vendor_links` rows onto `KITS` config (unknown slugs ignored). `KitTile` carries
  `{ slug, name, tagline, href }`.
- `src/app/dashboard/layout.tsx` — vendor shell: header (Wordmark + email + sign out,
  mirroring the qkit dashboard header) + `{children}`; calls `requireActiveVendor()`.
- `src/app/dashboard/page.tsx` — active kit tiles + a pending-kits section.
- `src/app/dashboard/vendor-kit-card.tsx` — one tile: name, tagline, "Live" badge,
  "Open [kit]" link → `href`.
- `src/app/dashboard/pending/page.tsx` — waitlist-aware pending page (own auth read).
- `src/app/dashboard/loading.tsx` — skeleton.

**Reuse:** `Wordmark`, `Button`, `Badge`, `signOutAction`, `createServerClient`
(cookie client, `merqo` schema), `KITS`/`QKIT_URL` from `kits.ts`.

**Modify:** `src/lib/supabase/middleware.ts` (`isProtectedPath` adds `/dashboard`);
`src/app/login/page.tsx`, `src/app/auth/callback/route.ts`,
`src/app/reset-password/page.tsx` (redirect to the resolver's destination instead of
a hardcoded `/admin`).

## Data flow

1. Vendor signs in (`/login`) with the granted email → resolver runs (server-side,
   reads `merqo_team` + own `vendor_links` via cookie client) → redirect.
2. `/dashboard` — `requireActiveVendor()` returns the vendor's `active`+`waitlist`
   links; `tilesForLinks` maps them to `KITS` metadata; page renders active tiles
   (open-links) + a pending section.
3. Open-link → the kit's own app (`KITS[].href`, e.g. `QKIT_URL`) in the kit's domain.

## Error handling

- Gate/config faults throw loudly (mirror `requireMerqoTeam`) — a missing grant or
  unexposed schema must not read as "no kits."
- A vendor whose only links are `waitlist` is routed to `/dashboard/pending`, not an
  empty `/dashboard`.
- Unknown/removed kit slugs in `vendor_links` are ignored by `tilesForLinks` (config
  is the display allow-list), so a stale slug can't crash a tile.

## Testing

- **Vitest (pure):** `resolveHome` (team → `/admin`; ≥1 active → `/dashboard`;
  waitlist-only → pending; none → pending), `tilesForLinks` (splits active vs
  waitlist, maps slug→KITS, drops unknown slugs).
- **Migration test:** extend `test/db/schema.test.ts` if it asserts grants/policies;
  otherwise document the manual RLS check (vendor sees only own rows).
- **Playwright:** `/dashboard` requires a session (signed-out → `/login`); keep the
  authed block behind the existing `MERQO_E2E_AUTH` guard.
- `pnpm check` clean; full suite green.

## Follow-on slices (own specs)

- **2b** — qkit `/api/merqo/vendor-summary?email=` (bearer) + a Merqo client; defines
  the per-vendor summary contract.
- **2c** — cross-kit highlight strip on `/dashboard` wired to 2b.
- **2d** — add-a-kit browse + behavior-triggered 1-click unlock (writes `vendor_links`).
- **2e** — vendor feedback submission → surfaces on `/admin/feedback` (completes the
  Phase-1 deferral).

## Open questions

- Vendor header nav: 2a has only one destination (`/dashboard`) + sign-out, so nav is
  minimal; it grows as 2c/2d/2e add sections. Build the header to accept a tab list
  now, seed it with just "Home."
- Whether `/dashboard/pending` should offer a "check again" action (re-runs the
  resolver) — cheap; include it, mirroring `/no-access`.
