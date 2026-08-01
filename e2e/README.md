# e2e

## Purpose

Playwright public smoke tests — the app boots and the landing/login pages
render without any Supabase provisioning. Runnable with only `pnpm dev` +
`playwright install`.

## Contents

- `smoke.spec.ts` — login page renders; landing renders with a "Sign in"
  action and the interactive kit stacker; a signed-out visitor hitting
  `/dashboard` is bounced to `/login`.

## Parent

[Merqo](../README.md)
