# components

## Purpose

Shared React components used across the dashboard, admin console, landing
page, and login page — everything that isn't a raw shadcn primitive (`ui/`)
or scoped to `dashboard/`/`landing/`.

## Contents

- `account-menu.tsx` — `AccountMenu`: the dropdown off the dashboard/admin
  header avatar — profile link, plan, Get help (opens `SupportForm` in a
  Sheet), Feedback (opens `FeedbackForm` in a Sheet), sign out, and an
  optional admin-switch link.
- `dashboard-tour.tsx` — `DashboardTour({ seen })`: owns the dashboard
  onboarding tour — a floating "?" replay button plus a lazily-imported
  `driver.js` overlay (loaded only when the tour actually runs). Auto-runs
  once for a user who hasn't seen it (server-tracked, stamped via
  `markTourSeen` as soon as the tour starts rather than when it finishes,
  so a mid-tour refresh can't re-trigger it), and can be replayed from any
  page (navigates back to `/dashboard` first if needed).
- `dashboard-tour.dom.test.tsx` — RTL tests for the tour's auto-run,
  mark-seen, and cross-page replay behavior.
- `tour-steps.ts` — `tourSteps()`: pure step config (element selector +
  title + description) for the dashboard tour, kept free of any DOM/React
  dependency so it's trivially unit-testable.
- `tour-steps.test.ts` — unit tests asserting the step list.
- `tour.css` — scoped styles for the `driver.js` popover (`.merqo-tour`
  class) so the tour overlay matches the app's visual language.
- `elevated-card.tsx` — `ElevatedCard({ as, className, children })`: the
  shared raised-card container (rounded, bordered, soft shadow) used by the
  login page and other kits' matching cards.
- `feedback-form.tsx` — `FeedbackForm`: hub-level NPS + comment widget,
  posts via `submitFeedbackAction`.
- `image-uploader.tsx` — `ImageUploader`: client-side resize-to-WebP then
  upload to Supabase Storage, with type/size validation.
- `info-tooltip.tsx` — `InfoTooltip`: shared (i) icon + tooltip trigger,
  parameterized on `ariaLabel`.
- `nps-card.tsx` — `NpsCard({ title, scores })`: renders an NPS score plus
  breakdown for the admin feedback page.
- `providers.tsx` — `Providers`: app-wide client providers (Radix
  `TooltipProvider`, `sonner` `Toaster`).
- `section.tsx` — `Section`: field-group card shell (icon chip, eyebrow,
  title, description, optional tooltip) for account-settings-style pages.
- `social-icons.tsx` — `SOCIAL_LINK_FIELDS`: shared vendor social-link field
  list with real brand marks.
- `social-links-fields.tsx` — `SocialLinksFields`: edit-form inputs for the
  social fields, labeled with `social-icons.tsx`'s marks.
- `support-form.tsx` — `SupportForm`: hub-level vendor/team → Merqo help
  request widget, posts via `submitSupportMessageAction`.
- `dashboard/` — components specific to the vendor dashboard. See its own
  README.
- `landing/` — components specific to the marketing landing page. See its
  own README.
- `ui/` — the shadcn/ui primitive library everything else in this tree is
  built from.

## Connectivity

`elevated-card.tsx` is used by `src/app/login/page.tsx`. `account-menu.tsx`
opens `feedback-form.tsx` and `support-form.tsx` in Sheets. `section.tsx`
composes `info-tooltip.tsx`. `social-links-fields.tsx` composes
`social-icons.tsx`.

## Parent

See the repo root [README.md](../../README.md) for the full `src/` layout.
