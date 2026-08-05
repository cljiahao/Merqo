# dashboard/profile

## Purpose

A one-route redirect shim, not a real page. `@merqo/ui`'s shared
`AccountMenu` hardcodes its Profile link to `/dashboard/profile` (the
convention every kit that keeps its account page under `/dashboard/`
follows), but Merqo's actual account-settings page is shared across both
the vendor dashboard and admin console and lives at the top-level
`src/app/profile/`. This folder exists solely to keep that hardcoded link
working without patching `@merqo/ui` itself.

## Contents

- `page.tsx` — `DashboardProfileRedirect()`: calls `redirect("/profile")`
  and renders nothing else.
- `page.test.tsx` — asserts the redirect target.

## Connectivity

Reached only via `@merqo/ui`'s `AccountMenu` "Profile" menu item (see
`src/components/account-menu.tsx`), rendered in both the `/dashboard` and
`/admin` headers. Immediately hands off to `src/app/profile/`.

## Parent

See the repo root [README.md](../../../../README.md) for the full `src/app/`
layout.
