# admin

## Purpose

The Merqo-team operator console — cross-kit revenue/activation overview, vendor
kit-access management, team membership, product health, and the shared
support/feedback inbox. Every route under this folder is gated by
`requireMerqoTeam()` (via `layout.tsx`).

## Contents

- `layout.tsx` — `AdminLayout`, the server-component gate for the whole `/admin`
  subtree: calls `requireMerqoTeam()` once so child pages can re-derive the user
  cheaply, resolves `canSwitch` (whether the signed-in team member also has an
  active vendor kit, via `hasActiveVendorAccess`) and the account's
  email/avatar, and passes them down to `<AdminNav>`.
- `admin-nav.tsx` — `AdminNav` client component. Owns the entire sticky header
  (burger button + `Wordmark` + `AccountMenu`) plus the section-tab nav
  (Overview / Vendors / Products / Team / Feedback), highlighting the active
  tab via `usePathname()`. Below `sm`, the tab row is replaced by a burger
  toggle beside the wordmark that reveals a mobile dropdown panel listing the
  same tabs — the same burger-beside-logo pattern as the vendor dashboard nav
  and every kit's own nav. The open/close state lives here (not in the server
  `layout.tsx`) because both the burger and the panel it reveals need it.
- `admin-nav.dom.test.tsx` — RTL/jsdom coverage of `AdminNav`: burger renders
  and toggles `aria-expanded`, clicking it opens/closes the mobile panel, the
  mobile panel lists the same tabs (and hrefs) as the desktop nav, and
  active-tab highlighting via a mocked `usePathname()`.
- `page.tsx` — `AdminOverviewPage` (`revalidate = 0`). Fetches live products,
  vendor grants, and open support messages in parallel, pulls each product's
  metrics via `fetchProductMetrics`, and derives ecosystem totals
  (`summarizeOverview`), per-product health (`classifyHealth`), and the
  onboarding funnel (`onboardingFunnel`). Renders `StatusBanner`, a
  "Needs attention" section (waitlisted vendors, open support messages,
  pending upgrade requests), summary `StatCard`s, `OnboardingFunnelView`, and
  a `ProductTile` grid.
- `loading.tsx` — skeleton for `page.tsx` (stat-card and product-tile shapes).
- `actions.ts` — `"use server"` module; `resolveSupportMessageAction(id)` marks
  a hub-level `support_messages` row resolved (team-gated, writes via the
  service client, revalidates `/admin`).
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
  `remove-member.tsx`, server `actions.ts`).
- `vendors/` — sub-route: vendor list + per-vendor (`[email]/`) kit-access
  grant/revoke management (`grant-form.tsx`, `revoke-button.tsx`, server
  `actions.ts`).

## Connectivity

`layout.tsx` wraps every route below it (including `feedback/`, `products/`,
`team/`, and `vendors/`) and is the only place the `requireMerqoTeam()` gate
and header data-resolution live; `AdminNav` reads `usePathname()` to highlight
whichever sub-route is active. `page.tsx` is the overview dashboard, built
from this folder's own components (`StatusBanner`, `OnboardingFunnelView`,
`ProductTile`, `SupportMessageRow`) plus shared `StatCard`
(`@/components/dashboard/stat-card`). `actions.ts` is called by
`resolve-support-message-button.tsx`, which client components trigger via
`useTransition` then `router.refresh()`.

See the repo root [README.md](../../../README.md) for the full `src/app/`
layout and how this console fits the rest of Merqo.
