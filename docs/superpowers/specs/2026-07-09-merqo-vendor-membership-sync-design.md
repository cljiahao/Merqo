# Vendor Membership Sync (Phase A — empty-state discovery) — Design

**Date:** 2026-07-09
**Status:** Approved (brainstorm)
**Scope:** A vendor who signed up directly on a kit (qkit/loopkit — each kit owns
its own Supabase Auth signup) becomes visible in Merqo's `vendor_links` without a
manual `/admin/vendors` grant. Pull-based, cache-aside, triggered only on the
existing empty-state page. Cross-repo: qkit, loopkit, Merqo.

## Context

All three apps (Merqo, qkit, loopkit) share one Supabase project (confirmed),
schema-per-app, with a shared `auth.users` at the project root. Architectural
rule (all three AGENTS.md files): cross-kit data only over HTTP, never a direct
cross-schema query — deliberate RLS/blast-radius isolation, not a technical
limit, and this feature does not violate it.

Today `merqo.vendor_links` (email-keyed, `product_slug` FK, `status`
`active`/`waitlist`) is written only by a Merqo-team manual grant
(`grantKit()` in `src/lib/admin.ts`). A vendor who signs up directly on qkit or
loopkit (each kit owns its own signup, per the consolidation brief's "no
flagship, no forced bundling") never gets a `vendor_links` row, so they land on
`/dashboard/pending` and see "no kits yet" — even though they're an active
paying user of a kit.

Confirmed intent (user): signing up for any kit implicitly makes the vendor a
client of the Merqo ecosystem; Merqo should be able to discover and reflect
that, not require a second manual step.

Existing reusable pattern: each kit already exposes `GET /api/merqo/metrics`,
guarded by a constant-time bearer check (`bearerOk()`, `timingSafeEqual`
against `process.env.MERQO_METRICS_SECRET`), consumed by Merqo's
`fetchProductMetrics()` (never throws, returns a typed `ok`/`reason` result).
The new endpoint and its consumer copy this exact shape.

## Goal

When a vendor with zero `vendor_links` rows loads `/dashboard/pending`, Merqo
asks every live kit "is this email an active vendor of yours?" If any kit says
yes, Merqo writes a `vendor_links` row and the vendor is redirected straight to
`/dashboard` — no team action required.

## Non-goals (Phase A)

- **No revocation / staleness sweep.** Once synced, a row is never re-checked
  or expired by this feature. If a vendor cancels on the kit side, Merqo keeps
  showing them as active until a human intervenes. This is a known, accepted
  gap — `last_verified_at` is added now specifically so a later Phase B (TTL /
  periodic reconciliation) can key off it without another migration.
- **No sync on every dashboard load.** Only triggered from the empty-state
  page, only when `links` is empty. A vendor who already has one active link
  never re-triggers a sync (existing links are the signal that they're already
  known).
- **No push/webhook from kit → Merqo.** Pull only, initiated by Merqo.
- **No new secret.** Reuses each kit's existing `MERQO_METRICS_SECRET`.
- **No UI for the vendor to manually "check again."** Phase A is silent
  best-effort on page load.

## Changes

### qkit — `src/app/api/merqo/vendor-status/route.ts` (new)

`GET /api/merqo/vendor-status?email=<email>`, same `bearerOk()` guard as
`api/merqo/metrics` (byte-identical import, same env var). `qkit.vendors` has
no email column (`id` references `auth.users(id)` directly, `name`/`plan`/
`created_at` only) — resolve email → user id first via
`supabase.auth.admin.listUsers()` (same pattern as `admin-vendor-health.ts`'s
`emailByUserId`), then look up that id in `vendors`. Found → `{active: true,
plan: vendors.plan}` (`Plan` is `"free"|"pro"`); no auth user or no vendor row
→ `{active: false, plan: null}`. `401` on bad bearer.
`export const revalidate = 0`.

### loopkit — `src/app/api/merqo/vendor-status/route.ts` (new)

Same contract and `bearerOk()` (already a verbatim port of qkit's, per the
existing comment in loopkit's metrics route). `loopkit.programs.vendor_id` and
`loopkit.vendor_pro.vendor_id` both reference `auth.users(id)`, no email
column — same email → user id resolution via `supabase.auth.admin.listUsers()`
(mirrors `admin-data.ts`'s `emailByUserId`), then: `active: true` if that id
owns at least one row in `programs`; `plan: "pro"` if that id has a row in
`vendor_pro`, else `"free"`.

### Merqo — `supabase/migrations/0005_vendor_link_sync.sql`

```sql
alter table merqo.vendor_links
  add column if not exists last_verified_at timestamptz;
```

`NULL` = manually granted by a Merqo team member (never touched by sync).
Non-`NULL` = written by `syncVendorKits`, timestamped at write. Phase B's
future reconciliation sweep keys off this column; Phase A only ever sets it,
never reads it.

### Merqo — `src/lib/vendor-sync.ts` (new)

- `checkVendorStatus(kit: RegistryRow, email: string): Promise<{active: boolean; plan: string | null} | null>`
  — calls the kit's `vendor-status` endpoint with the bearer secret; mirrors
  `fetchProductMetrics`'s never-throw handling (network error, non-200,
  malformed JSON all resolve to `null`, never reject).
- `syncVendorKits(email: string): Promise<VendorLink[]>` — reads live kits from
  `merqo.products`, calls `checkVendorStatus` against each in parallel, and for
  every `active: true` result, upserts a `merqo.vendor_links` row
  (`status: "active"`, `last_verified_at: now()`) via the service-role client
  (mirrors `grantKit`'s write path). Returns the vendor's current links after
  the sync (so the caller can redirect immediately without a second read).

### Merqo — `src/app/dashboard/pending/page.tsx` (wiring)

When `loadVendorContext()` returns empty `links`, call
`syncVendorKits(user.email)` once before rendering the empty state. If the
result is non-empty and `hasRenderableActiveKit` is true, redirect to
`/dashboard` (same as the existing active-kit branch). If still empty, render
today's "no kits yet" copy unchanged — a sync failure or genuine no-match is
indistinguishable to the vendor, and that's correct (no user-facing error
surface for a background best-effort check).

## Error handling

Every kit call is isolated and non-throwing (`checkVendorStatus` swallows
network/timeout/shape errors → `null`, excluded from the upsert set). One kit
being down never blocks discovery on another kit, and never breaks the pending
page — worst case is the vendor sees the same empty state they see today.

## Testing

- **qkit / loopkit — vendor-status route:** mirrors each repo's existing
  `metrics` route test (bearer required → 401; found vendor → `active:true` +
  plan; unknown email → `active:false`).
- **Merqo — `vendor-sync.test.ts`:** mirrors `metrics-client.test.ts`'s style
  — `checkVendorStatus` never throws on fetch error/bad status/bad JSON;
  `syncVendorKits` upserts only for `active:true` results, sets
  `last_verified_at`, and calls all live kits in parallel (not sequential).
- **Merqo — `pending/page` test:** empty links + a mocked positive sync →
  redirects to `/dashboard`; empty links + all-negative/failed sync → renders
  empty state unchanged.
- `pnpm check` clean in all three repos; full suite green in all three.

## Open questions

- None blocking. Phase B (TTL/reconciliation sweep keyed off
  `last_verified_at`) is deferred, not scheduled.
