# dashboard/(app)

## Purpose

The vendor dashboard's active-kit overview and kit-discovery home —
`/dashboard` for a vendor with at least one kit grant (a route group so
`pending/`'s no-active-kit state can share the parent `dashboard/` URL
without this group's own segment showing in the path). Gated one level up by
`dashboard/layout.tsx`'s `requireActiveVendor()` call.

## Contents

- `layout.tsx` — `DashboardLayout`. Resolves the signed-in vendor/team
  context via `requireActiveVendor()`, redirects admins to `/admin` and a
  brand-new user to `/onboarding` before this group's header shell paints,
  renders the sticky header (`Wordmark` + `@/components/account-menu.tsx`'s
  `AccountMenu`), and mounts `DashboardTour` with the vendor's
  `dashboard_prefs.tour_seen_at` threaded through as `seen`. Also, if
  `tour_seen_at` is unset, calls `@/lib/tour-prefs`'s `stampTourSeen`
  directly, synchronously, as part of this request, before returning JSX —
  the durable half of the onboarding-tour "stamp on start" fix; see
  `src/lib/README.md` and `tour-actions.ts` below for why the client-fired
  path alone isn't reliable.
- `layout.test.tsx` — RTL coverage: logo link, account menu rendering, the
  admin switch link for a team member, the tour's replay button, and that
  `stampTourSeen` fires when `tour_seen_at` is null/missing and never fires
  once it's already set.
- `page.tsx` — `DashboardPage` (`revalidate = 0`). Re-syncs the vendor's kit
  grants (`syncVendorKits`) so a kit added elsewhere shows up without a
  fresh login, computes savings (`computeVendorSavings`) and per-kit live
  metrics (`fetchVendorMetrics`), and renders — urgency-first, directly under
  the `h1` — a merged "Needs your attention" band (requested + needs-setup
  kits, admin overview's colored-row treatment), then the active-kit grid
  (`VendorKitCard`), then a `border-t`-divided "Explore more kits" /
  "Complete your toolkit" discovery section (`KitDiscoveryCard` +
  `ActivateKitsButton`/`JoinWaitlistButton`).
- `page.test.tsx` — RTL coverage of the page's kit-grouping and re-sync
  behavior.
- `loading.tsx` — skeleton shown while `page.tsx`'s data resolves.
- `savings-summary.tsx` — `SavingsSummary({ totals })`: the page-level total
  of the per-card savings estimates, with an `InfoTooltip` (`@merqo/ui`)
  explaining the estimate's basis.
- `vendor-kit-card.tsx` — `VendorKitCard({ tile, savings, metrics, now })`:
  one active kit's card — plan badge, per-kit savings line (same
  `InfoTooltip` from `@merqo/ui`), `VendorMetricList`, and the
  `UpgradeButton`/`DowngradeButton` pair.
- `upgrade-button.tsx` / `downgrade-button.tsx` — `UpgradeButton`/
  `DowngradeButton({ slug })`: file a Free→Pro/Pro→Free plan-change request
  for one kit via `requestUpgrade`/`requestDowngrade`, with inline (no
  toast) success/error feedback.
- `vendor-metric-list.tsx` — `VendorMetricList({ result, now })`: renders a
  kit's headline metric (in the "Harbour Control" theme's amber "value
  moment" accent, as of 2026-08-19) plus up to three supporting figures,
  or a graceful "not connected yet" message when the kit has no metrics
  endpoint or is unreachable.

## Connectivity

`layout.tsx` wraps `page.tsx` and every route in this group. `page.tsx`
composes `savings-summary.tsx`, `vendor-kit-card.tsx` (which itself renders
`vendor-metric-list.tsx` and the upgrade/downgrade buttons), and the shared
`@/components/dashboard/` discovery cards. See `src/components/README.md`
for `AccountMenu`/`DashboardTour`'s `@merqo/ui` wiring.

## Parent

See the repo root [README.md](../../../../README.md) for the full `src/app/`
layout.
