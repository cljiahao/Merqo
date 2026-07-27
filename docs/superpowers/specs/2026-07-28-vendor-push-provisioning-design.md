# Vendor Push Provisioning + One-Click Kit Activation — Design

**Date:** 2026-07-28
**Status:** Approved (brainstorm)
**Scope:** A vendor signed in to Merqo hub can activate qkit and/or loopkit
with one click each, or both at once, without leaving the hub or going
through that kit's own signup flow. Cross-repo: qkit, loopkit, Merqo.
**Companion feature to:** `2026-07-09-merqo-vendor-membership-sync-design.md`
(pull-based discovery of vendors who signed up directly on a kit). This
spec adds the push direction — Merqo creating a vendor's tenant row on a
kit it doesn't have one on yet.

## Context

All kit repos already share one Supabase project and one `auth.users`
table (confirmed, `2026-07-17-merqo-roadmap.md`) — a vendor's identity is
already unified project-wide. What's missing is the ability for Merqo hub
to actually create a vendor's tenant row on a kit (e.g. qkit's `vendors`
table) on their behalf; today the dashboard's "Add {kit}" link just opens
that kit's own `/login` in a new tab, and the vendor has to go through
whatever flow that kit's own login page offers.

**Founder's stated vision:** one click on the Merqo dashboard to onboard
into every kit at once, then move easily between products — the long-term
goal is Merqo feeling like one connected product, not a suite the vendor
has to separately discover and join per kit. This spec is Phase 1 toward
that vision: provisioning only. True zero-relogin switching between kits
needs shared-cookie SSO, which itself needs the planned `*.merqo.net`
subdomain migration (not started, no date) — explicitly out of scope here,
a separate future spec once that migration lands.

**Scope correction found during design (real, pre-existing issues, not
caused by this feature):**

- `merqo.products.status` — the DB column `listLiveProducts()` actually
  filters on for the existing pull-sync — has loopkit and paykit both
  seeded as `coming_soon` (migration `0004_kit_consolidation.sql`), despite
  `src/lib/kits.ts` (the landing/dashboard *display* config, a separate,
  static source of truth) showing both as fully `live`. This means
  **today's existing sync already silently excludes loopkit and paykit
  from vendor auto-discovery** — a vendor who signs up directly on either
  is only ever surfaced via a manual admin grant. Pre-existing bug,
  discovered while scoping this feature, fixed as a prerequisite (see
  Changes below) because this feature's fan-out would otherwise inherit
  the exact same blind spot.
- paykit has zero `/api/merqo/*` routes of any kind (no `metrics`, no
  `vendor-status`) despite being a mature, 69-commit product with a real
  login/dashboard. Building `vendor-provision` for paykit means building
  its first-ever cross-kit integration route from scratch, with no sibling
  route in that repo to mirror — meaningfully bigger and riskier than
  qkit/loopkit's version. **Excluded from this spec's scope**, flagged as
  a follow-up.
- stockkit is a real, 50-commit product (stock movements, product
  components, already syncs `merqo.vendor_profile`) that
  `2026-07-17-merqo-roadmap.md` calls "genuinely not started" — that
  doc is stale on this point. stockkit is not in `kits.ts`'s live tier and
  has no `/api/merqo/*` routes either. **Excluded from this spec's scope**
  — whether/when to promote it to a live, discoverable kit is a separate
  product decision, not something to fold into this design.

## Goal

A signed-in vendor on `/dashboard` can:

1. Click **"Activate all my kits"** (bulk) — provisions every kit this
   feature currently supports (qkit, loopkit) in one action, or
2. Click **"Add {kit}"** on an individual kit card (already existed as a
   dumb external link; becomes a real provisioning action) — provisions
   just that one kit.

Either path creates a free-tier tenant row on the target kit(s) for the
vendor's existing `auth.users.id`, immediately reflected as an active tile
on `/dashboard` — no waiting for the next pull-sync, no visit to that
kit's own signup page.

The bulk button is the visually primary CTA on the dashboard's empty/
discovery state (per the founder's one-click vision); the per-kit
individual actions remain available as secondary, smaller affordances —
both stay, this is a decided default/emphasis, not an either/or.

Do not hardcode "2" or "3" anywhere in copy or logic — both the bulk
button and its target list must be driven by whichever kits actually
support `vendor-provision`, so paykit/stockkit can join later (a follow-up
spec) without a copy or logic change here.

## Non-goals

- **No cross-domain SSO / shared session.** Opening a kit's own dashboard
  after activation still lands the vendor on that kit's own `/login` the
  first time (no session sharing across origins yet) — but they can sign
  in immediately with their existing credentials (shared `auth.users`),
  no separate signup confusion. True seamless switching is Phase 2, a
  separate future spec once `*.merqo.net` subdomains exist.
- **No paykit, no stockkit.** See scope correction above — explicitly
  deferred, not silently dropped.
- **No billing/tier logic beyond free.** Provisioning always creates a
  free-tier row; upgrading to Pro stays the existing separate
  upgrade-request flow, untouched by this feature.
- **No HMAC/signature scheme, no idempotency-key header.** A distinct
  bearer secret + DB-level `ON CONFLICT DO NOTHING` is sufficient at this
  scale (one known internal caller, single-PK insert) — validated against
  SCIM/OAuth/Stripe precedent during design research; see Error handling.
- **No retry logic inside each kit's own route.** Retry ownership lives at
  exactly one layer (Merqo hub's fan-out), so retries can't compound
  across hops.

## Changes

### Merqo — `supabase/migrations/0013_fix_loopkit_live_status.sql` (new, prerequisite)

```sql
update merqo.products set status = 'live' where slug = 'loopkit';
```

Fixes the scope-correction bug above. This alone also fixes the existing
pull-sync's blind spot for loopkit (a beneficial side effect, not the
point of this feature) — verify with a `vendor-sync.test.ts` assertion
that `listLiveProducts()` includes loopkit after this migration.

### qkit — `src/app/api/merqo/vendor-provision/route.ts` (new)

`POST /api/merqo/vendor-provision`, body `{ user_id: string }`. Guarded by
`bearerOk()` against a **new** `MERQO_PROVISION_SECRET` env var — distinct
from `MERQO_METRICS_SECRET` (used by `metrics`/`vendor-status`), because
this is a write capability (creates a real tenant row) with materially
higher blast radius than a read-only status check; a leak of the routine
polling secret must not also grant "silently create an account for any
user_id on any kit." Same `bearerOk()`/`timingSafeEqual` mechanism, just a
different secret value — mirrors the mechanism, not literally shares the
credential.

Insert into `vendors` (`id: user_id`, `plan: 'free'`) with
`ON CONFLICT (id) DO NOTHING`; `vendors.id` already FKs to
`auth.users(id)`, so a forged/non-existent `user_id` fails cleanly at the
DB level regardless of the bearer check. Response:
`{ ok: true, already_existed: boolean, plan: "free" | "pro" }` (read back
the current plan whether this call created the row or it already
existed); `401` on bad bearer. `export const revalidate = 0`.

### loopkit — `supabase/migrations/0032_loopkit_provision_default_program.sql` (new, prerequisite)

Discovered during planning: `loopkit.programs` creation normally goes
through the `create_program` RPC, which is `SECURITY DEFINER` but keyed
entirely on the CALLING session's `auth.uid()` (`v_uid := (select
auth.uid())`; raises `not authorized` if null) — a service-role call has
no user session, so `auth.uid()` is null and this RPC cannot be used here
at all, regardless of intent. A raw table insert is also not a simple
mirror: `programs` has grown a `type`-dependent JSONB `config` shape
(stamp/lucky/plant variants), `head_start`, `reward_expiry_days`, etc.

New, narrowly-scoped function instead — same insert shape as
`create_program`'s stamp-type branch, but keyed on an explicit parameter
and grant-restricted to `service_role` only (never `authenticated`, so it
can't become a second, unchecked way for a vendor to create programs for
themselves, bypassing the free-tier active-program cap `create_program`
itself enforces):

```sql
create or replace function loopkit.provision_default_program(p_vendor_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into loopkit.programs
    (vendor_id, type, name, stamps_required, reward_text, config, active)
  values (
    p_vendor_id, 'stamp', 'Starter', 10, '1 free item',
    '{"points_per_visit": 1, "variant": "dots"}'::jsonb, true
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function loopkit.provision_default_program(uuid) to service_role;
-- deliberately NOT granted to authenticated
```

`type: 'stamp'` (singular — matches `buildProgramFields`'s branch and
every other reference in this codebase; not `'stamps'`), `config` matches
the exact shape `buildProgramFields` produces for a vendor-created stamp
card via `/setup` (`points_per_visit: 1`, `variant: "dots"`, no
`stamp_mark`/`reward_text`/`stamps_required` duplicated into config beyond
what `add_stamp` actually reads at runtime — `stamps_required` and
`reward_text` live on the `programs` row itself, not inside `config`).
Fully editable afterward via the vendor's own `/setup` (`saveProgramAction`
already supports editing any existing program regardless of how it was
created).

### loopkit — `src/app/api/merqo/vendor-provision/route.ts` (new)

Same contract, same new `MERQO_PROVISION_SECRET`. loopkit's "active" is
defined (by the existing `vendor-status` route) as "owns at least one row
in `programs`" — a bare `loopkit.vendors` insert alone would NOT satisfy
that. On `ON CONFLICT (vendor_id) DO NOTHING` against `loopkit.vendors`
(`vendor_id: user_id`, `plan: 'free'`), if this call created the row (i.e.
wasn't `already_existed`), also call `loopkit.provision_default_program(user_id)`
via `supabase.rpc(...)` (service-role client — the only role this function
is granted to). If the vendor row already existed (re-provision case), do
NOT call it — never create a second program or touch one the vendor may
have already customized/replaced. Response:
`{ ok: true, already_existed: boolean, plan: "free" | "pro" }`.

### Merqo — `src/lib/vendor-sync.ts` (extend)

- `provisionVendorKit(kit: RegistryRow, userId: string): Promise<ProvisionResult>`
  — mirrors `checkVendorStatus`'s never-throw shape (network error,
  timeout, non-200, malformed JSON all resolve to a typed failure, never
  reject). **3-second timeout** (shorter than `checkVendorStatus`'s 5s —
  this blocks a user-initiated write, not a best-effort background
  check; inserting one row is normally sub-100ms, so a multi-second hang
  signals real trouble, not "needs more time"). On failure, **one
  automatic retry** after a ~1.5s fixed delay, then give up and return the
  failure — no backoff series, no retry inside the route itself.
- `provisionVendorKits(user: {id, email}, slugs: string[]): Promise<VendorLink[]>`
  — reads the requested kits from `listLiveProducts()` (now correctly
  including loopkit post-migration), calls `provisionVendorKit` against
  each **in parallel via `Promise.allSettled`** (never `Promise.all` — one
  kit's failure must never mask another's success), and for every
  successful result upserts a `vendor_links` row (`status: "active"`,
  `plan` from the response, `last_verified_at: now()`) via the same
  service-role upsert path `syncVendorKits` already uses. Returns the
  vendor's current links plus a per-kit outcome list (which kits
  succeeded, which still failed after the retry) so the caller can render
  partial results, not one aggregate pass/fail.

### Merqo — new server action + dashboard wiring

- `activateKitsAction(slugs: string[])` — auth-gated (reuses
  `requireActiveVendor`/`loadVendorContext`'s user-resolution), calls
  `provisionVendorKits(user, slugs)`, revalidates `/dashboard`.
- Dashboard empty/discovery state: a primary **"Activate all my kits"**
  button (bulk — calls the action with every kit currently supporting
  provisioning) plus the existing `KitDiscoveryCard`'s per-kit "Add
  {kit}" CTA, upgraded from a dumb external link to a button invoking the
  same action with a single-slug array.
- Button disables while the action is in-flight (prevents double-submit —
  the insert is idempotent but a duplicate fan-out is still wasted work).
- Per-kit outcome rendering: a kit that succeeds becomes an active tile
  immediately (post-revalidate); a kit that still failed after the one
  retry shows an inline "couldn't activate — retry" affordance scoped to
  just that kit (re-invokes the action with only that slug), never a
  blocking page-level error.

## Error handling

Every kit call isolated and non-throwing (mirrors `checkVendorStatus`).
One kit being down never blocks the other's activation or breaks the
dashboard — worst case, the vendor sees one active tile and one retry
affordance, never an error page. Retry ownership lives at exactly one
layer (Merqo hub's fan-out) — neither kit's own route retries internally,
so a slow-but-eventually-successful downstream can't cause compounding
duplicate work across layers.

## Testing

- **qkit / loopkit — `vendor-provision` route:** bearer required (401
  without/with the wrong secret — specifically confirm the *metrics*
  secret does NOT also authorize this route); first call creates the
  tenant row at `plan: "free"`; second call with the same `user_id` is a
  no-op returning `already_existed: true`; a non-existent `user_id` fails
  the FK constraint cleanly, not a silent no-op.
- **loopkit-specific:** `provision_default_program` is executable by
  `service_role` and NOT by `authenticated` (grant check — a vendor must
  never be able to call this directly and bypass their own plan-cap
  gate); first provisioning call creates exactly one default `programs`
  row (`type: 'stamp'`, `Starter`, 10 stamps, "1 free item") and the
  vendor now reads as `active: true` via the existing `vendor-status`
  route; a second provisioning call (already-existing vendor) creates NO
  additional `programs` row, even if the vendor already replaced/edited
  their program — re-provisioning must never touch an existing program.
- **Merqo — `vendor-sync.test.ts` additions:** `provisionVendorKit` never
  throws on fetch error/timeout/bad status/bad JSON (mirrors
  `checkVendorStatus`'s existing test style); `provisionVendorKits` uses
  `allSettled` (one kit rejecting doesn't prevent the other's upsert),
  retries exactly once on failure before giving up, upserts only for
  eventual successes.
- **Merqo — migration test:** `listLiveProducts()` includes loopkit after
  `0012_fix_loopkit_live_status.sql` (also closes the existing pull-sync's
  blind spot for loopkit as a verified side effect).
- **Merqo — dashboard/action test:** bulk button disabled while in-flight;
  a partial failure (one of two kits fails after retry) renders that
  kit's inline retry affordance, not a page-level error; neither button
  ever hardcodes a kit count.
- `pnpm check` clean in qkit, loopkit, merqo; full suite green in all
  three.

## Open questions

- **paykit and stockkit follow-up** — not blocking this spec, but tracked:
  paykit needs its first-ever `/api/merqo/*` routes (bigger, separate
  work than mirroring an existing sibling); stockkit needs a product
  decision on whether/when it's promoted out of `kits.ts`'s "planned"
  tier before any provisioning route is worth building for it. Neither
  is scheduled.
- **Phase 2 (SSO/true seamless switching)** — deferred until the
  `*.merqo.net` subdomain migration has a real date; not scheduled here.
