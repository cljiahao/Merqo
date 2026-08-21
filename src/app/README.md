# app

## Purpose

Next.js App Router tree — public brand landing, the role-gated operator
console, auth, and shared account pages.

## Contents

- `actions/` — server actions shared across routes.
- `admin/` — Merqo-team console: overview + vendors/, team/, products/, feedback/ (all auth-gated).
- `api/` — route-handler API endpoints: merqo's own third Telegram bot's
  webhook, and the bearer-secret endpoints qkit/loopkit call INTO merqo
  for the customer Telegram-connect flow — the first kit → merqo HTTP
  direction in this codebase; see its own README.
- `apple-icon.tsx` — `AppleIcon` route handler; renders a 180×180 PNG for iOS home-screen touch icons.
- `auth/` — Supabase auth callback route (OAuth code exchange).
- `dashboard/` — vendor dashboard: `(app)/` (active-kit overview + kit discovery), `pending/` (no-active-kit state), and `profile/` (a redirect shim to `/profile` — `@merqo/ui`'s `AccountMenu` hardcodes its Profile link to `/dashboard/profile`, the convention every other kit follows, but Merqo's real shared account page lives at the top-level `/profile`).
- `error.tsx` / `global-error.tsx` — root React error boundaries.
- `globals.css` — Tailwind v4 entry point: theme tokens, an `@layer base` reset (including the `* { border-color: var(--border) }` default — this MUST stay inside `@layer base`, since Tailwind v4's `@import "tailwindcss"` puts every generated utility class in `@layer utilities`, and an unlayered rule always wins the cascade over a layered one regardless of selector specificity; an unlayered version of this exact reset previously defeated every `border-<color>` utility in the app), custom utility classes, and `@source "../../node_modules/@merqo/ui/dist"` (tells Tailwind to scan the built `@merqo/ui` package for utility classes, since it lives outside `src/` and wouldn't otherwise be picked up by Tailwind's default content scan). Color tokens are named "Harbour Control" in the file's own header comment (harbour-navy primary, buoy-amber accent), replacing "Control Room" (pine-green + marigold-gold) — the founder-approved cross-kit brand pick as of 2026-08-19. Dark-mode tokens live under a `.dark` class selector (`@custom-variant dark (&:is(.dark *));`), not a `prefers-color-scheme` media query, so `next-themes`' manual toggle can override the OS preference. Also defines `.tour-example`/`.tour-example-row`/`.tour-example-pill`/`.tour-example-label`, the shared styling for the small HTML preview embedded in a dashboard-tour step's description (see `src/components/README.md`'s `tour-steps.ts` entry) — same class names and token-driven styling every other kit's `globals.css` carries for the same purpose. `--card`/`--popover` were fixed to differ from `--background` in both modes after the Harbour Control rebrand had accidentally collapsed them to the same value.
- `icon.tsx` — `Icon` route handler; renders the 32×32 PNG favicon.
- `layout.tsx` — `RootLayout`; fonts, metadata, `Providers`, wrapped in `next-themes`' `ThemeProvider` (`attribute="class"`) so `@merqo/ui`'s `AccountMenu` Light/Dark/System control can drive `globals.css`'s `.dark` class.
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
`admin/` the Merqo-team console; `profile/` is shared by both. `api/` is
an internal/ops surface, reached by Telegram's own servers and by sibling
kits, never by a browser inside this app. `layout.tsx` is the ancestor of
every route below; `page.tsx` (the landing page) is the only route
directly under `app/` besides the special Next.js files.

## Parent

[src](../README.md)
