# app

## Purpose

Next.js App Router tree — public brand landing, the role-gated operator
console, auth, and shared account pages.

## Contents

- `actions/` — server actions shared across routes.
- `admin/` — Merqo-team console: overview + vendors/, team/, products/, feedback/ (all auth-gated).
- `apple-icon.tsx` — `AppleIcon` route handler; renders a 180×180 PNG for iOS home-screen touch icons.
- `auth/` — Supabase auth callback route (OAuth code exchange).
- `dashboard/` — vendor dashboard: `(app)/` (active-kit overview + kit discovery) and `pending/` (no-active-kit state).
- `error.tsx` / `global-error.tsx` — root React error boundaries.
- `globals.css` — Tailwind v4 entry point: theme tokens, base layer, custom utility classes.
- `icon.tsx` — `Icon` route handler; renders the 32×32 PNG favicon.
- `layout.tsx` — `RootLayout`; fonts, metadata, `Providers`.
- `login/` — email/password sign-in.
- `no-access/` — shown when a signed-in user has no kit access and no admin role.
- `not-found.tsx` — branded 404.
- `page.tsx` — `Home` async server component, the public brand landing page. Composes `Nav`, `Hero`, `Benefits`, `KitStacker`, `HowItWorks`, `Faq`, `Footer`, and `BackToTop` from `@/components/landing/`. No CTA band above the footer, matching qkit.
- `post-login/` — post-authentication redirect router (dashboard vs admin vs no-access).
- `profile/` — shared account page (signed-in gate only — reachable from both the vendor dashboard and the admin console).
- `reset-password/` — password-reset flow.

## Connectivity

`login/` is the sign-in entry point; `post-login/` routes a freshly
authenticated user onward. `dashboard/` is the vendor-facing area,
`admin/` the Merqo-team console; `profile/` is shared by both. `layout.tsx`
is the ancestor of every route below; `page.tsx` (the landing page) is the
only route directly under `app/` besides the special Next.js files.

## Parent

[src](../README.md)
