# admin

## Purpose

The Merqo-team operator console — cross-kit revenue/activation overview, vendor
kit-access management, team membership, product health, the shared
support/feedback inbox, and the admin-audit trail. Every route under this
folder is gated by `requireMerqoTeam()` (via `layout.tsx`).

## Contents

- `layout.tsx` — `AdminLayout`, the server-component gate for the whole `/admin`
  subtree: calls `requireMerqoTeam()` once so child pages can re-derive the user
  cheaply, resolves `canSwitch` (whether the signed-in team member also has an
  active vendor kit, via `hasActiveVendorAccess`) and the account's
  email/avatar, and passes them down to `<AdminNav>`.
- `admin-nav.tsx` — `AdminNav` client component. Owns the entire sticky header
  (burger button + `Wordmark` + `AccountMenu`) plus the section-tab nav
  (Overview / Vendors / Products / Team / Feedback / Activity), highlighting
  the active tab via `usePathname()`. Below `sm`, the tab row is replaced by a
  burger toggle beside the wordmark that reveals a mobile dropdown panel
  listing the same tabs — the same burger-beside-logo pattern as the vendor
  dashboard nav and every kit's own nav. The open/close state lives here (not
  in the server `layout.tsx`) because both the burger and the panel it
  reveals need it.
- `admin-nav.dom.test.tsx` — RTL/jsdom coverage of `AdminNav`: burger renders
  and toggles `aria-expanded`, clicking it opens/closes the mobile panel, the
  mobile panel lists the same tabs (and hrefs) as the desktop nav, and
  active-tab highlighting via a mocked `usePathname()`.
- `page.tsx` — `AdminOverviewPage` (`revalidate = 0`). Fetches live products,
  vendor grants, open support messages, and cross-kit billing settings
  (`getBillingSettings`) in parallel, pulls each product's
  metrics via `fetchProductMetrics`, and derives ecosystem totals
  (`summarizeOverview`), per-product health (`classifyHealth`), and the
  onboarding funnel (`onboardingFunnel`). Renders `StatusBanner`, a
  "Needs attention" section (waitlisted vendors, open support messages,
  pending upgrade requests), summary `StatCard`s, `OnboardingFunnelView`, a
  "Settings" section (`BundleDiscountToggle`), and a `ProductTile` grid.
- `loading.tsx` — skeleton for `page.tsx` (stat-card and product-tile shapes).
- `actions.ts` — `"use server"` module; `resolveSupportMessageAction(id)` marks
  a hub-level `support_messages` row resolved (team-gated, writes via the
  service client, revalidates `/admin`); `setBundleDiscountEnabledAction(enabled)`
  flips the `merqo.billing_settings` singleton's `bundle_discount_enabled`
  flag (team-gated, same write pattern). No kit reads this flag yet — see
  `bundle-discount-toggle.tsx` below. Both call `recordAudit()` (`@/lib/admin`)
  after a successful write (`resolve_support_message`, `toggle_bundle_discount`
  — see `activity/page.tsx` below for where these surface).
- `actions.test.ts` — mocked `requireMerqoTeam`/`createServiceClient`/
  `recordAudit`/`revalidatePath` coverage for both actions above: happy path
  (asserting the `recordAudit` call), a DB-error path (asserting no audit row
  is recorded), and (for the bundle-discount action) confirms the team gate is
  checked before any database call.
- `bundle-discount-toggle.tsx` — `BundleDiscountToggle({ enabled })` client
  component. A single shadcn `Switch` + label describing the current
  state (off: "vendors pay full price per kit"; on: "15/25/30% off at
  2/3/4 active kits") — flips `setBundleDiscountEnabledAction` in a
  transition and toasts success/failure. The cross-kit bundle discount
  ships off by default (see
  `docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md`); this
  is the lever, not the discount math itself, which stays Phase 3-gated.
- `bundle-discount-toggle.test.tsx` — RTL/jsdom coverage: on/off state
  text and switch-checked state, calling the action with the flipped
  value on click, toast success/error, and the switch disabling while
  the action is pending.
- `onboarding-funnel.tsx` — `OnboardingFunnelView({ counts })`. Renders the
  3-stage vendor onboarding funnel (Waitlisted → Granted → Using) as
  relative-magnitude bars against each stage's raw count. Deliberately shows
  no stage-to-stage conversion percentage — the three counts are distinct,
  non-narrowing populations (`using` can exceed `granted` by design, per
  `OnboardingCounts`' own contract in `src/lib/funnel.ts`), so a "% of
  previous stage" figure would misrepresent the data rather than just round
  it oddly.
- `product-tile.tsx` — `ProductTile({ name, result, now })`. One kit's card on
  the overview grid: health badge (reporting/lagging/down), revenue/active-
  vendor figures, and GMV/signups/pro-vendor/orders chips with a 7d trend
  arrow; renders an "Unavailable"/"Auth error"/"Bad response" placeholder when
  `result.ok` is false.
- `status-banner.tsx` — `StatusBanner({ reporting, lagging, down })`. Single-
  line, color-coded, icon-led summary of ecosystem-wide product health.
- `support-message-row.tsx` — `SupportMessageRow({ message })`. One row in the
  "Needs attention" support-message list; shows which kit a message came from
  (`kit_slug`, `null` renders as "merqo") plus category and body.
- `resolve-support-message-button.tsx` — `ResolveSupportMessageButton({ id })`
  client component; calls `resolveSupportMessageAction` in a transition and
  toasts on failure.
- `feedback/` — sub-route: per-kit NPS/CSAT breakdown plus a combined,
  kit-tagged vendor-comments list, backed by `merqo.vendor_feedback`.
- `products/` — sub-route: product/kit registry health list
  (`product-health-card.tsx`).
- `team/` — sub-route: add/remove Merqo-team members (`add-team-form.tsx`,
  `remove-member.tsx`, server `actions.ts`). Both actions call
  `recordAudit()` after a successful write (`add_team_member`,
  `remove_team_member`) — `add_team_member`'s `target_id` is the newly
  added member's own user id (returned by `addTeamMemberByEmail()`), not
  the acting admin's.
- `vendors/` — sub-route: vendor list + per-vendor (`[email]/`) kit-access
  grant/revoke management (`grant-form.tsx`, `revoke-button.tsx`, server
  `actions.ts`). Both actions call `recordAudit()` after a successful write
  (`grant_kit_access`, `revoke_kit_access`) — vendors are email-keyed with
  no stable uuid at grant time, so `target_id` is `null` and the vendor
  email + kit slug travel in `detail` instead.
- `activity/` — sub-route (`page.tsx` + `page.test.tsx`): `AdminActivityPage`
  server-fetches the most recent 100 `merqo.admin_audit` rows via
  `listAdminAuditEntries()` (`@/lib/admin`) and renders them with `@merqo/ui`'s
  `AuditLogTable`, mapping each row to an `AuditLogEntry` (`actor` = the
  resolved admin email, `target` = `target_id`, `detail` = the `detail` jsonb
  stringified) and a `formatAction()` lookup from raw action strings (see the
  bullets above for the full list) to human labels.

## Connectivity

`layout.tsx` wraps every route below it (including `feedback/`, `products/`,
`team/`, `vendors/`, and `activity/`) and is the only place the
`requireMerqoTeam()` gate and header data-resolution live; every real
mutating action across those sub-routes (plus this folder's own `actions.ts`)
calls `recordAudit()`, and `activity/page.tsx` is where those rows surface.
`AdminNav` reads `usePathname()` to highlight
whichever sub-route is active. `page.tsx` is the overview dashboard, built
from this folder's own components (`StatusBanner`, `OnboardingFunnelView`,
`ProductTile`, `SupportMessageRow`) plus shared `StatCard`
(`@/components/dashboard/stat-card`). `actions.ts` is called by
`resolve-support-message-button.tsx`, which client components trigger via
`useTransition` then `router.refresh()`.

See the repo root [README.md](../../../README.md) for the full `src/app/`
layout and how this console fits the rest of Merqo.
