# login

## Purpose

Vendor sign-in page — email/password sign-in/sign-up and Google OAuth in a
single client component, matching the login page shape shared across every
Merqo kit.

## Contents

- `page.tsx` — `LoginPage`/`LoginForm`: `ElevatedCard`-wrapped form with
  Google OAuth (`signInWithOAuth`, forced `hl=en`), email/password
  sign-in/sign-up via `react-hook-form` + `loginSchema` (`@/lib/schemas`),
  a "check your email" state for signup confirmation, and forgot-password
  via `resetPasswordForEmail`.

## Connectivity

Uses `ElevatedCard` (`@merqo/ui`) for the card container.
Successful sign-in/sign-up navigates to `/post-login`, which selects the
account's vendor or team destination.

Google branding uses `GoogleMark` from `@merqo/ui`; no local copy remains.

## Parent

See the repo root [README.md](../../../README.md) for the full `src/app/`
layout.
