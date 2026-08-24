# components

## Purpose

Shared React components used across the dashboard, admin console, landing
page, and login page — everything that isn't a raw shadcn primitive (`ui/`)
or scoped to `dashboard/`/`landing/`.

## Contents

- `account-menu.tsx` — `AccountMenu`: thin adapter composing `@merqo/ui`'s
  shared `AccountMenu` for the dashboard/admin header avatar dropdown —
  wires Merqo's `signOutAction` (through a `handleSignOut` wrapper that
  swallows the `NEXT_REDIRECT` control-flow error `signOutAction`'s
  `redirect()` throws on success, since `@merqo/ui`'s `useAsyncAction`
  otherwise forwards that throw to `onError` and toasts it even though the
  redirect itself succeeded), `submitFeedbackAction`/
  `submitSupportMessageAction` (throw-adapting, since both return
  `{success, error}` rather than throwing), the support-category list, and
  the optional cross-persona switch link (`extraLink`). No `/dashboard/plan`
  or kit-local settings route exists, so `showPlanItem` is off and
  `kitLocalSettingsHref` is omitted. Merqo has no per-user display name
  distinct from email at this level, so `email` fills both the shared
  component's `vendor.name` (initials fallback only) and `vendor.subtitle`
  (the one line actually shown). Passes `LinkComponent={Link}` (`next/link`)
  so the shared component's internal links use client-side navigation
  instead of a full page reload.
- `account-menu.test.tsx` — RTL tests: trigger subtitle/initials, menu-item
  order (no Plan item), the switch link, Feedback/Get-help submit wiring
  (including the category-fallback and inline-error paths), and sign-out.
- `dashboard-tour.tsx` — `DashboardTour({ seen })`: thin adapter wiring
  Merqo's own step content (`tour-steps.ts`), `markTourSeen`, and routing
  into `@merqo/ui`'s shared `DashboardTour`, which owns the tour mechanism
  itself (`driver.js` lifecycle, auto-run/replay timing, popover styling).
- `dashboard-tour.dom.test.tsx` — RTL tests asserting the props threaded
  into the shared `DashboardTour` (steps resolver, seen, routing,
  `scopeClassName`) — the tour mechanism itself is `@merqo/ui`'s own tests'
  job.
- `tour-steps.ts` — `tourSteps()`: pure step config (element selector +
  title + description) for the dashboard tour, kept free of any `driver.js`
  import so it's still node-unit-testable. The account-menu step targets
  `[data-tour="nav-account"]` — `@merqo/ui`'s `AccountMenu` trigger's own
  hardcoded anchor, not a Merqo-chosen name. The "your kits" step's
  description embeds a `.tour-example` HTML snippet (styled in
  `src/app/globals.css`, rendered via driver.js's own `innerHTML` popover)
  showing a realistic kit-card preview, same pattern as every other kit's
  first tour step — its plan-tier pill renders the real `Badge` component
  (`renderToStaticMarkup`) instead of a hand-copied color, so it can't
  drift from what the badge actually looks like; see
  `../../../docs/superpowers/specs/2026-08-25-tour-example-badge-drift-fix-design.md`
  (workspace root, cross-kit).
- `tour-steps.test.ts` — unit tests asserting the step list.
- `elevated-card.tsx` — `ElevatedCard({ as, className, children })`: the
  shared raised-card container (rounded, bordered, soft shadow) used by the
  login page and other kits' matching cards.
- `nps-card.tsx` — `NpsCard({ title, scores })`: renders an NPS score plus
  breakdown for the admin feedback page.
- `providers.tsx` — `Providers`: app-wide client providers (Radix
  `TooltipProvider`, `sonner` `Toaster`).
- `social-icons.tsx` — `SOCIAL_LINK_FIELDS`: shared vendor social-link field
  list with real brand marks.
- `social-links-fields.tsx` — `SocialLinksFields`: edit-form inputs for the
  social fields, labeled with `social-icons.tsx`'s marks.
- `dashboard/` — components specific to the vendor dashboard. See its own
  README.
- `landing/` — components specific to the marketing landing page. See its
  own README.
- `ui/` — the shadcn/ui primitive library everything else in this tree is
  built from.

## Connectivity

`elevated-card.tsx` is used by `src/app/login/page.tsx`. `account-menu.tsx`
and `dashboard-tour.tsx` are thin wiring layers over `@merqo/ui`'s shared
`AccountMenu`/`DashboardTour` — see the root [README.md](../../README.md)
for what else `@merqo/ui` provides and where each piece is used.
`social-links-fields.tsx` composes `social-icons.tsx`. `InfoTooltip` and
`Section` (formerly local `info-tooltip.tsx`/`section.tsx`) and
`ImageUploader` (formerly local `image-uploader.tsx`) are now imported
directly from `@merqo/ui` at their call sites instead of living here — see
`src/app/profile/README.md` and `src/lib/README.md`'s
`image-upload-adapter.ts` entry. `FeedbackForm`/`SupportForm` (formerly
local, opened from `account-menu.tsx`'s Sheets) are gone entirely —
`@merqo/ui`'s `AccountMenu` owns that Sheet chrome directly now.
`account-menu.test.tsx`'s menu-order test now expects a "Theme · System"
entry, matching `@merqo/ui` v0.19.0's collapsed theme submenu.

## Parent

See the repo root [README.md](../../README.md) for the full `src/` layout.
