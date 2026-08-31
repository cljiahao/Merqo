# Open the Merqo dashboard to every signed-in user

Date: 2026-08-31

## Problem

Today `/dashboard` is gated by `requireActiveVendor()`: a signed-in user with
no `vendor_links` row of `status = 'active'` is bounced to `/dashboard/pending`.
A vendor who has onboarded a kit (paykit, qkit, …) but whose Merqo-side
`vendor_links` row does not yet exist — because the kit → Merqo sync only runs
on Merqo login or on the `/dashboard/pending` page — cannot see the dashboard at
all.

Merqo is not a paid product. It is a free management hub: one place to see and
run whichever kits a seller uses. There is no Pro tier to gate. The active-kit
requirement is therefore the wrong gate — it turns a discovery surface into a
locked door for exactly the people it is meant to serve.

## Decision

`/dashboard` becomes reachable by **any authenticated user**. The page itself
adapts:

- **No kits yet** → a "pick a kit to get started" surface: the existing
  "Explore more kits" discovery section plus a friendlier zero-state hero with
  the bulk `ActivateKitsButton`.
- **One or more kits** → the current management overview (savings, per-kit
  cards, live metrics), unchanged.

Team members are still sent to `/admin` as their post-login home, and still
reach `/dashboard` via the existing account-menu switch link — no change.

`/admin` gating (`requireMerqoTeam()`) is untouched.

## Changes

### Routing / gate (`src/lib/vendor.ts`)

- `HomeDestination` narrows to `"/admin" | "/dashboard"`.
- `resolveHome({ isTeam })` → `isTeam ? "/admin" : "/dashboard"`. Drops the
  `hasActiveKit` input.
- Delete `dashboardGateDestination()` — nothing to gate on any more.
- Replace `requireActiveVendor()` with `requireVendorSession()`: loads the
  vendor context, redirects to `/login` when there is no user, and returns
  `{ user, links, isTeam }`. No active-kit check, no redirect for team members
  (the dashboard layout already offers them a switch link).

### Post-login (`src/app/post-login/route.ts`)

- `resolveHome({ isTeam })`; drop the `hasRenderableActiveKit` call.
- Sync with `{ force: true }` so a fresh login always re-checks the kits,
  bypassing the new throttle.

### Sync throttle (`src/lib/vendor-sync.ts` + migration)

`syncVendorKits()` runs on every dashboard render (`revalidate = 0`). With the
gate gone, that includes users with zero kits, who would otherwise fan out an
HTTP call to every live kit on every page view.

- New table `merqo.vendor_sync_state (email text primary key, last_synced_at
timestamptz not null default now())`. RLS enabled, zero policies,
  `select, insert, update` granted to `service_role` only — same
  service-role-only shape as `telegram_link_tokens`. `syncVendorKits` is the
  only caller and it already uses the service-role client.
- `syncVendorKits(email, { force? })`: unless `force`, read `last_synced_at`;
  if it is within `SYNC_TTL_MS` (60_000) of now, skip the fan-out and return
  the vendor's current `vendor_links` straight from the DB. On a fan-out,
  upsert `last_synced_at = now()` afterwards.

### Dashboard page (`src/app/dashboard/(app)/page.tsx`)

- `requireActiveVendor` → `requireVendorSession`.
- When the vendor has no active, pending, or needs-setup kit, render a
  zero-state hero ("Pick a kit to get started" + bulk `ActivateKitsButton`)
  above the existing discovery section instead of the "N of M kits connected"
  line and the empty card grid.

### Dashboard layout (`src/app/dashboard/(app)/layout.tsx`)

- `requireActiveVendor` → `requireVendorSession`. Tour logic unchanged.

### Delete `/dashboard/pending`

- Remove `src/app/dashboard/pending/`. Its discovery UI and the "activate all"
  affordance already exist on the dashboard page (or move there as the
  zero-state hero).
- `src/app/actions/activate-kits.ts`: drop the
  `revalidatePath("/dashboard/pending")` line.
- `src/components/dashboard-tour.dom.test.tsx`: the `/dashboard/pending`
  pathname fixture becomes `/dashboard`.

## Not doing

- **No push webhook from kits.** The correct long-term fix is each kit calling
  Merqo on vendor onboarding (`/api/merqo/vendor-registered`) so the link
  appears instantly with no polling. That needs changes in all five kit repos
  and is out of scope here. The 60s-throttled pull covers the gap in the
  meantime — a kit onboarded seconds ago shows up on the next dashboard visit.
- **No client-side background sync.** The dashboard page is already an async
  server component that syncs inline; a separate `/api/dashboard/sync` route +
  client trigger would duplicate that for no gain.

## Testing

- `vendor.test.ts` — `resolveHome` (team → `/admin`, non-team → `/dashboard`);
  remove `dashboardGateDestination` coverage.
- `vendor-sync.test.ts` — throttle: skips the fan-out when `last_synced_at` is
  fresh, runs it when stale, runs it when `force`.
- `dashboard/(app)/page.test.tsx` / `layout.test.tsx` — retarget the gate mock;
  add the zero-kits hero case.
- `supabase/tests/rls.test.sql` — `vendor_sync_state`: RLS on, no client role
  can read it.
