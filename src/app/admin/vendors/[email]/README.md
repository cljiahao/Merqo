# [email]

## Purpose

One vendor's detail view in the Merqo-team console: which kits they're
granted, a grant/revoke control per kit, a form to grant a new one, and —
new here — a live cross-kit "Activity" section so an ops person can see
what that vendor is actually doing on each kit without opening every kit's
own admin console separately.

## Contents

- `page.tsx` — `VendorDetailPage` (`revalidate = 0`). Team-gated
  (`requireMerqoTeam`); 404s via `notFound()` if the email has no grant at
  all. Renders the existing Kits list + Grant form, plus a new Activity
  section: for every kit slug the vendor is `active` on (from
  `getVendorGrant`), calls `getVendorActivity()`
  (`@/lib/vendor-activity-client`) in parallel against the live kit
  registry (`listLiveProducts`), and renders one `VendorActivityCard` per
  successful result. A kit with no grant, a kit that 404s/times out, or a
  kit that hasn't implemented `/api/merqo/vendor-activity` yet all just
  render no card — never an error state.
- `page.test.tsx` — mocked-dependency coverage: renders a card only for
  active-status kits (not waitlist), renders no Activity section at all
  when the vendor has zero active kits, and calls `notFound()` when the
  grant doesn't exist.
- `vendor-activity-card.tsx` — `VendorActivityCard({ slug, result, now })`.
  Renders nothing when `!result.ok` or the kit reports `active: false`;
  otherwise a `StatusBadge` (skipped entirely when `status` is `null` —
  e.g. loopkit, which has no per-vendor health concept yet), a plan
  `Badge`, the kit's `metrics` rows via `@merqo/ui`'s `StatTile`, and a
  relative "last activity" timestamp.
- `vendor-activity-status-config.ts` — the shared `StatusBadge` `config`
  for the 6-value cross-kit `VendorActivityStatus` union
  (`attention`/`expiring`/`stuck`/`quiet`/`new`/`healthy`), mapped onto
  merqo's own semantic tokens — unlike each kit's own status-badge (which
  maps onto that kit's own brand tokens), this is merqo's single console,
  so every card reads consistently regardless of which kit it's reporting
  on.

## Parent

[admin](../../README.md)
