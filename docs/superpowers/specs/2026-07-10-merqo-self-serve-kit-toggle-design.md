# Self-Serve Kit Toggle + Tier Display — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** Merqo repo only — no new endpoints on qkit/loopkit. Extends the
existing vendor-membership-sync (Phase A) machinery to (1) refresh membership

- tier on every login instead of only the empty-links case, (2) show a tier
  badge + upgrade link on each active kit tile, and (3) let a vendor self-serve
  "add" a live kit they haven't joined yet by deep-linking to that kit's own
  login page.

## Context

Phase A (shipped) auto-discovers a vendor's _existing_ kit signups the first
time they land on an empty `/dashboard/pending`. Two gaps remained, both
raised together: (a) a vendor already active on one kit has no way to add a
_second_ kit without a Merqo-team manual grant, and (b) Merqo shows no
indication of which tier (free/pro) a vendor is on for each kit.

Grounding in qkit's actual code settled the shape: `auth.users` is shared
across the whole Supabase project (confirmed earlier), but each kit's own
domain-specific row (`qkit.vendors`, `loopkit.programs`) is created lazily by
that kit's own `/onboarding` step, _after_ a sign-in on that kit's own domain
(`qkit/src/app/onboarding/actions.ts:22`). A vendor who already has any
account can sign in on any kit's own domain with the same credentials — no
new provisioning API needed. qkit also already owns a complete self-serve
tier-upgrade flow (`qkit/src/app/dashboard/plan/upgrade-cta.tsx` →
`purchase_requests` → admin confirms payment) — Merqo doesn't rebuild that,
it links to it.

## Goal

1. A vendor's tier (free/pro) per active kit is visible on `/dashboard`,
   refreshed on every login.
2. A vendor can add a live kit they haven't joined by clicking a link on
   `/dashboard` that sends them to that kit's own login page — no Merqo-side
   provisioning step.
3. A free-tier vendor sees an upgrade link to that kit's own upgrade page.

## Non-goals

- **No new endpoints on qkit/loopkit.** The existing `/api/merqo/vendor-status`
  contract already returns `plan` — Phase A just discarded it; this feature
  starts persisting it. No kit-side code changes.
- **No cross-domain session handoff.** "Add a kit" is a plain link to
  `<kit-domain>/login`; the vendor signs in there themselves. Explicitly
  rejected the "Merqo provisions directly" alternative — it would require a
  new privileged write endpoint per kit and a session-handoff mechanism
  neither kit has today.
- **No live-per-page-load tier refresh.** Tier is cached on `vendor_links`
  and refreshed only when a sync runs (every login) — not on every
  `/dashboard` render. Rejected for latency: `/dashboard` is visited far more
  often than login, and a live HTTP round-trip per active kit on every view
  reintroduces the "sync on every load" cost Phase A deliberately avoided.
- **No auto-revocation.** If a kit now returns `active:false` for a link
  Merqo currently shows as active, that link is left untouched — same Phase A
  rule. Only a positive match ever writes. Downgrading/removing a stale link
  automatically is real Phase B territory (still deferred, not scheduled).
- **No new manual "refresh" button.** The existing "Check again" button on
  `/dashboard/pending` already re-invokes `/post-login`, which is now itself
  the sync trigger — so a manual re-check already exists without new UI.

## Changes

### `supabase/migrations/0006_vendor_link_tier.sql`

```sql
alter table merqo.vendor_links
  add column if not exists plan text;
```

Nullable, no CHECK — different kits may introduce different tier vocabularies
later; the existing `vendorStatusSchema` (`plan: z.string().nullable()`) is
already generic. `NULL` means "never synced with a plan value" (e.g. a
manually-granted row) — same NULL-means-unsynced convention as
`last_verified_at`.

### `src/lib/vendor-sync.ts`

- `upsertsFromChecks` gains `plan` in its output rows (from the same
  `VendorStatusCheck`, which already carries it) — trivial extension, no
  signature change to its two existing parameters.
- `syncVendorKits` unchanged in structure (still upserts on `active:true`,
  still never throws, still reads back and returns current links). The
  upserted row now includes `plan`.
- `VendorLink` (in `@/lib/vendor.ts`) gains `plan: string | null`, and the
  `select("product_slug, status")` read in `syncVendorKits` becomes
  `select("product_slug, status, plan")`.

### `src/app/post-login/route.ts`

Currently only computes routing from the vendor's _existing_ links. Now
always syncs first (for a non-team user with an email), so both new-kit
discovery and tier refresh happen once per login, before the redirect
decision is made:

```ts
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const links =
    !isTeam && user.email ? await syncVendorKits(user.email) : initialLinks;
  const dest = resolveHome({
    isTeam,
    hasActiveKit: hasRenderableActiveKit(links),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
```

`syncVendorKits` never throws, so a bad kit/network/DB hiccup here degrades
to `initialLinks`'s prior state, not a broken redirect. `dashboard/pending`'s
own defensive sync-on-empty-links stays as-is (unchanged) — cheap,
idempotent, and covers a vendor who reaches that page via a stale bookmark
without passing through `/post-login`.

### `src/lib/vendor.ts`

- `VendorLink` type: add `plan: string | null`.
- `KitTile` type: add `plan?: string | null` (only meaningful for active
  tiles).
- `tilesForLinks`: active tiles now carry `plan` from the link row.
- New pure function `addableKits(links, kits = KITS)`: live kits (`status ===
"live"`) with **no** `vendor_links` row at all for that slug (not active,
  not waitlist) — the "you haven't joined this yet" set. Returns `KitTile[]`
  (same shape, `href` always set since only live kits qualify).

### `src/app/dashboard/(app)/page.tsx` + `vendor-kit-card.tsx`

- Page computes `addable = addableKits(links)` alongside the existing
  `active`/`pending` split and passes it to a new section, rendered only
  when non-empty (same conditional-render convention as the existing
  "Requested" section).
- New section, "Add a kit": one row per addable kit — name, tagline, a
  button linking to `${kit.href}/login` (opens in a new tab, same pattern as
  the existing "Open {name}" button).
- `VendorKitCard` gains a tier badge next to the existing "Live" badge:
  `plan === "pro"` → a "Pro" badge; `plan === "free"` → a "Free" badge +
  an "Upgrade to Pro" link to `${tile.href}/dashboard/plan`; `plan === null`
  (never synced with a plan, e.g. a manual grant) → no badge, unchanged from
  today.

## Error handling

No new failure surface. `syncVendorKits`'s existing never-throw contract
covers the new call site (`/post-login`) exactly as it already covers
`/dashboard/pending`. "Add a kit" and "Upgrade" are plain anchor links, not
new server calls — if a kit's domain is down, the vendor sees that kit's own
error page, not a Merqo failure.

## Testing

- **Migration `0006`:** SQL-text assertion, same style as `0005`'s test —
  confirms the column exists, is nullable, no `NOT NULL`.
- **`upsertsFromChecks`:** existing tests updated to assert the `plan` field
  is included in the output rows.
- **`vendor.ts`:** new tests for `addableKits` — a live kit with no link row
  is included; a live kit with an existing active OR waitlist row is
  excluded; a non-live (`coming`/`planned`) kit is never included regardless
  of link state. Existing `tilesForLinks` tests extended to assert `plan`
  passes through on active tiles.
- **`/post-login` route:** no dedicated test, matching the existing
  convention (this route already has none) — the sync-always behavior is
  covered by `syncVendorKits`'s own tests plus manual verification.
- `pnpm check` clean; full suite green.

## Open questions

None blocking. `${kit.href}/dashboard/plan` as the upgrade-page convention is
qkit's real, already-shipped path — future kits should follow the same route
shape, but that's a convention to document for kit builders, not something
this spec enforces in code.
