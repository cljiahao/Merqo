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
