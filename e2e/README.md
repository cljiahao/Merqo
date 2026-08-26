# e2e

## Purpose

Playwright public smoke tests — the app boots and the landing/login pages
render without any Supabase provisioning. Runnable with only `pnpm dev` +
`playwright install`.

## Contents

- `smoke.spec.ts` — login page renders; landing renders with a "Sign in"
  action and the interactive kit stacker; a signed-out visitor hitting
  `/dashboard` is bounced to `/login`. Also gates an `authed areas` block
  behind `MERQO_E2E_AUTH=1` (CI's `e2e-admin` job only): admin
  overview/vendors/products/team/activity pages render, granting/revoking a
  vendor's kit access round-trips through the real admin-audit trail
  (checked on `/admin/activity`), and adding/removing a team member works.

## Parent

[Merqo](../README.md)
