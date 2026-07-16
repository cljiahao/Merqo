# Shared Vendor Profile (stall name + social links) — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorm)
**Scope:** Three repos — merqo (owns the new schema + functions), qkit
(cutover: migrate its existing local `vendors.name`/`vendors.social_links`
onto the shared table, keep its own `booths.social_links` override),
loopkit (fresh read-only adoption — no existing vendor-identity fields to
migrate).

## Context

Raised in `docs/business/2026-07-12-merqo-roadmap.md`'s "Future
Considerations" section: every kit shares one Supabase project (one
`auth.users`), but each kit currently makes a vendor onboard their stall
identity separately. loopkit has no vendor-identity fields at all today
(confirmed by grep — nothing to migrate). qkit already shipped a **local**
version of half of this: `qkit.vendors.name` (stall name) and
`qkit.vendors.social_links` (JSONB `{website?, instagram?, facebook?,
tiktok?}`, migration `0052_vendor_social_links.sql`) with a per-booth
override (`qkit.booths.social_links`, `NULL` = inherit, non-null = whole-object
override — not merged, matching the same convention already used by
`booths.hours`/`booths.payment`). That's real, shipped, tested code — this
spec does not reinvent it, it lifts it up so loopkit (and any future kit)
shares the same data instead of re-onboarding a vendor's identity from
scratch.

`qkit.booths.name` is `NOT NULL` and always its own value — it is not a
"defaults to vendor name, optionally overridden" field and never was. So the
override pattern in this spec applies only to `social_links`, not to stall
name.

## Goal

1. One shared `stall_name` + `social_links` per vendor, readable and
   writable from any kit, editable from wherever the vendor happens to be.
2. A vendor who signs up directly on loopkit (never touches merqo or qkit)
   gets their profile row created lazily on first save — no dependency on
   merqo onboarding.
3. qkit's existing per-booth `social_links` override keeps working exactly
   as today, just reading its fallback default from the shared table instead
   of `qkit.vendors.social_links`.
4. No second, un-synced copy of vendor identity left behind in qkit after
   this ships.

## Non-goals

- **No visual branding** (logo, colors, fonts) — out of scope, a separate
  future spec if pursued.
- **No stall-name override at the booth/card level.** Confirmed booths
  always have their own required `name`; this spec does not add an
  inherit-or-override concept for it.
- **No description/bio field.** Nothing today asks for it or would consume
  it (YAGNI) — `stall_name` + `social_links` only. Add it later, as its own
  migration, the day something actually needs it.
- **No cross-schema raw table access.** Confirmed by grep across
  qkit/loopkit/merqo: every existing cross-kit or cross-schema touchpoint
  (`place_order`, `qkit_earn_lookup`, `merqo.emit_metric` called from a
  Postgres trigger) already goes through a function, never a raw
  `SELECT`/`UPDATE` on another schema's table. This spec follows the same
  rule — no client, and no kit's app code, ever queries
  `merqo.vendor_profile` directly.
- **No HTTP round-trip.** All kits already share one physical Postgres
  instance (confirmed — this is not a new coupling, it's the existing
  deployment). Access is `supabase.rpc(...)` from each kit's own client, same
  cost as querying its own schema.

## Data model

### `merqo.vendor_profile` (new, merqo migration `0009`)

```sql
create table merqo.vendor_profile (
  vendor_id     uuid primary key,
  stall_name    text not null,
  social_links  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table merqo.vendor_profile enable row level security;
-- Zero policies — deny-all for anon/authenticated, same convention as
-- merqo.kit_events (0008). No client queries this table directly; only
-- through the SECURITY DEFINER functions below.
```

`social_links` shape matches qkit's existing `socialLinksSchema` exactly —
`{website?, instagram?, facebook?, tiktok?}` — validated at the Zod boundary
in each kit's own code, not at the DB. JSONB chosen to match qkit's already-
shipped, deliberate precedent (see Context) rather than split into typed
columns — consistency with existing code beats the generic small-fixed-key-
set argument for columns here.

### Functions (merqo migration `0009`, same file)

```sql
create or replace function merqo.get_or_create_vendor_profile(
  p_vendor_id uuid,
  p_default_stall_name text default null
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  select * into v_row from merqo.vendor_profile where vendor_id = p_vendor_id;
  if found then
    return v_row;
  end if;
  insert into merqo.vendor_profile (vendor_id, stall_name)
  values (p_vendor_id, coalesce(p_default_stall_name, 'My Stall'))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function merqo.upsert_vendor_profile(
  p_vendor_id uuid,
  p_stall_name text,
  p_social_links jsonb default '{}'::jsonb
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  insert into merqo.vendor_profile (vendor_id, stall_name, social_links, updated_at)
  values (p_vendor_id, p_stall_name, p_social_links, now())
  on conflict (vendor_id) do update
    set stall_name   = excluded.stall_name,
        social_links = excluded.social_links,
        updated_at   = now()
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.get_or_create_vendor_profile(uuid, text) to authenticated, service_role;
grant execute on function merqo.upsert_vendor_profile(uuid, text, jsonb) to authenticated, service_role;
```

Both functions trust `p_vendor_id` as given — same trust boundary as every
other `authenticated`-role RPC in this codebase (the caller is already an
authenticated Supabase session; a vendor calling with someone else's
`vendor_id` would be a pre-existing class of bug across the whole stack, not
new here). No `auth.uid() = p_vendor_id` check is added because none of the
existing precedent functions (`place_order`, `qkit_earn_lookup`) add one
either — consistent with current practice, not a new gap.

## qkit cutover

1. **Backfill migration** (qkit repo, numbered after qkit adopts the merqo
   migration — see Open Questions on sequencing): one-time
   `insert into merqo.vendor_profile (vendor_id, stall_name, social_links)
select id, name, social_links from qkit.vendors on conflict (vendor_id) do nothing;`
2. **Code swap**: `src/app/dashboard/profile/actions.ts`'s `updateStallName`
   and `updateSocialLinks` call `merqo.upsert_vendor_profile(...)` instead of
   `update qkit.vendors set ...`. Profile page reads via
   `merqo.get_or_create_vendor_profile(...)` instead of selecting
   `vendors.name`/`vendors.social_links`.
3. **Booth override unchanged in shape** — `qkit.booths.social_links` stays
   exactly as-is (still `NULL` = inherit, still whole-object override). Only
   its fallback source changes: wherever the code today reads
   `vendor.social_links` as the default to merge/display, it now reads the
   value returned by `get_or_create_vendor_profile` instead.
4. **Drop `qkit.vendors.name` and `qkit.vendors.social_links`** in a follow-up
   migration once the code swap is deployed and verified — not the same
   migration as the backfill, so there's a window to confirm the cutover
   worked before the old columns are gone for good.

## loopkit adoption

No existing data to migrate. loopkit calls
`merqo.get_or_create_vendor_profile(vendor_id, default_stall_name)` the
first time a vendor reaches any screen that wants to show stall
name/socials (e.g. the customer-facing `/c` card, or `/setup`), and
`merqo.upsert_vendor_profile(...)` if/when loopkit adds its own settings UI
for editing it. No per-card override in this spec — loopkit can add one
later, following qkit's `booths.social_links` pattern, if a real need shows
up (YAGNI for now).

## Error handling

- `get_or_create_vendor_profile` never fails on a missing row — it creates
  one. A malformed `p_default_stall_name` (empty string) falls back to
  `'My Stall'` rather than erroring, so a first-touch call from a kit that
  doesn't yet have a name to offer degrades gracefully.
- `upsert_vendor_profile` relies on the calling kit's own Zod validation
  (`socialLinksSchema`) before the RPC call — the function itself does not
  re-validate `social_links` shape, matching how `qkit.vendors.social_links`
  is handled today (DB stores whatever JSONB it's given; shape is an
  application-layer contract, "any malformed shape degrades to `{}`" is
  qkit's own existing rule, kept as-is).
- If a caller RPCs with a `vendor_id` that doesn't correspond to a real
  `auth.users` row, both functions still succeed today (no FK to
  `auth.users` on `vendor_profile.vendor_id` in this design) — deliberately
  loose, matching `merqo.kit_events.vendor_id`'s same choice (also no FK),
  to avoid a cross-schema FK dependency on `auth.users` from a function two
  schemas removed from where the user actually authenticates.

## Testing

- **`merqo/supabase/migrations/0009`**: pgTAP test extending the existing
  `merqo` migration-test convention — confirms `vendor_profile` RLS is
  deny-all (no policy), confirms both functions are `SECURITY DEFINER` and
  granted to `authenticated`/`service_role` only.
- **qkit**: existing `actions.test.ts` (f) "passes social_links through to
  the row untouched" gets updated to assert the RPC call shape instead of
  the raw `.update()` call; `profile-form.dom.test.tsx` unaffected (UI
  contract unchanged, only the server action's implementation moves).
- **loopkit**: new unit test for whatever calls
  `get_or_create_vendor_profile` first — asserts a first-time vendor gets a
  created row, a repeat call returns the same row unchanged.
- **Contract-style test** (new, `merqo` repo, mirrors paykit's
  `test/contract/` precedent): calls both functions via a real Postgres
  connection in CI, asserting the create-then-upsert-then-read round trip.

## Open questions

- **Cross-repo migration ordering.** merqo's `0009` migration (creates
  `vendor_profile` + functions) must be applied to the shared Postgres
  instance _before_ qkit's backfill migration runs (it references
  `merqo.vendor_profile`). Today's deploy process has no documented
  cross-repo migration-ordering convention — this spec surfaces the need for
  one; whoever runs the qkit backfill migration needs to confirm merqo's
  `0009` is already live first. Flagging for human review, not resolving
  here.
- **Column-drop timing** — "once deployed and verified" in the qkit cutover
  section is intentionally vague on a hard date; recommend leaving the old
  columns in place for at least one full deploy cycle after the code swap
  ships, then dropping in a dedicated migration.
