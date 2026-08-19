# Merqo

House brand + operator console for a modular family of small-business tools
("kits") for Singapore micro/small sellers. `qkit` (queue/orders), `loopkit`
(stamp-card loyalty), `paykit` (payments), and `stockkit` (inventory) are
live; `shopkit` and `reachkit` are upcoming (see `src/lib/kits.ts`).

This app is the public brand landing plus a role-gated operator console:

- `/dashboard` — cross-product metrics overview (post-login home)
- `/admin/vendors` — grant/revoke kit access per vendor
- `/admin/team` — manage Merqo-team members
- `/admin/products` — per-kit health from the metrics API
- `/admin/feedback` — vendor NPS + comments per kit

Each kit runs its own app on its own schema in a shared Supabase project.
Merqo pulls per-kit metrics over an HTTP API (bearer secret) — it never
queries another kit's schema directly. Brand theme is "Harbour Control"
(harbour-navy primary, buoy-amber accent) as of 2026-08-19, replacing
"Control Room" (pine-green + marigold-gold) — see `globals.css`'s own
header comment. `src/lib/brand-icon.tsx`'s ImageResponse-generated
favicon/apple-touch-icon carries the same rebrand. In production, every kit's auth
cookie is scoped to `.merqo.io` (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`,
`src/lib/supabase/`), so signing in on one kit signs you in on the rest —
unset in dev/preview, where each kit still runs on its own `*.vercel.app`
host. The dashboard's onboarding tour (`src/components/dashboard-tour.tsx`)
stamps its "seen" state as soon as it auto-runs rather than when it
finishes, so a refresh mid-tour can't make it re-trigger on the next load —
and since that client-fired stamp is fire-and-forget and can be aborted by
a hard navigation (the tour's own steps spotlight `@merqo/ui`'s
`AccountMenu` trigger, whose dropdown renders links as plain `<a>` tags),
`/dashboard`'s own server render (`src/app/dashboard/(app)/layout.tsx`)
also stamps it synchronously, durably, as part of the request. The tour's
"your kits" step now spotlights the active-kit grid (`data-tour="kit-cards"`)
with an inline example kit-card preview in its description, the same
example-card treatment every other Merqo kit's own onboarding tour carries
on its first step. The landing footer matches qkit's exactly (single-row
wordmark/tagline/credit-line/sign-in link, no CTA band above it).

Merqo runs on `@merqo/ui` (`github:cljiahao/merqo-ui#v0.11.1`), the shared
component package for the kit family (see qkit/loopkit/paykit/stockkit for
the same dependency). `useAsyncAction`, `InfoTooltip`, `Section`,
`TwoColumnSections`, `ImageUploader`, and `DashboardTour` are used directly
or through a thin per-app adapter (`src/hooks/use-async-action.ts`,
`src/lib/image-upload-adapter.ts`, `src/components/dashboard-tour.tsx`).
`account-menu.tsx` composes `@merqo/ui`'s `AccountMenu` for **both** the
vendor dashboard and admin-console headers — Merqo's own dual-persona
structure (unlike a single-persona kit) means neither header uses the
shared package's composed `DashboardNav` (burger + inline nav links): the
vendor dashboard has no nav links to show, and the admin console's own
tab-row-below-header nav (`admin-nav.tsx`) is visually distinct enough to
keep hand-rolled. `@merqo/ui`'s `ProfileForm` (an all-in-one form) is not
used either — `src/app/profile/profile-form.tsx` needs a password-change
section the shared component doesn't have, so it composes `Section`/
`TwoColumnSections`/`ImageUploader` individually instead, same as qkit.
`@merqo/ui`'s `AccountMenu` hardcodes its Profile link to
`/dashboard/profile`; `src/app/dashboard/profile/page.tsx` redirects that
to Merqo's real, persona-shared `/profile` route. The landing nav
(`src/components/landing/nav.tsx`) is built on `@merqo/ui`'s `LandingNav`
shell (`wordmark`/`end` slots), added in v0.9.0. v0.10.0 added an optional
`LinkComponent` prop to `AccountMenu`/`DashboardNav` so Next.js consumers can
opt their internal nav links out of a plain `<a>`'s full page reload;
`account-menu.tsx` passes `LinkComponent={Link}` (`next/link`).

## Stack

Next.js 16 · App Router · Turbopack · TypeScript strict · Tailwind v4 ·
shadcn/ui (new-york) · Zod · Supabase (`@supabase/ssr`) · Vitest ·
Playwright · pnpm 11 · Node ≥24 · deploy target: Vercel

## Commands

```bash
pnpm dev          # dev server — http://localhost:3000
pnpm build        # production build
pnpm test         # run test suite (vitest)
pnpm test:e2e     # playwright public smoke
pnpm check        # prettier --check + eslint + tsc --noEmit
pnpm format       # prettier --write
```

## Dependencies

`pnpm-workspace.yaml`'s `overrides` block pins transitive deps (postcss,
nanoid, undici, fast-uri, js-yaml, brace-expansion, sharp) past known CVE
thresholds — `pnpm audit --prod --audit-level=high` (CI's `security.yml`
`audit` job) hard-gates on these. When a new advisory lands on a transitive
dep, bump its floor here rather than waiting on the upstream package to
update; a floor set too low silently stops helping once a newer vulnerable
release ships within the allowed range.

## File layout

```
src/app/                    — app router (landing, dashboard, admin console, server actions)
src/app/page.tsx            — public brand landing (static-prerendered)
src/app/dashboard/          — vendor dashboard: (app)/ (active-kit overview + kit discovery)
                               and pending/ (no-active-kit state)
src/app/admin/              — Merqo-team console: overview (page.tsx) + vendors/, team/,
                               products/, feedback/ (all auth-gated)
src/app/profile/            — shared account page (signed-in gate only — reachable from
                               both the vendor dashboard and the admin console)
src/app/login/              — email/password sign-in
src/app/api/telegram/webhook/ — merqo's own Telegram bot's webhook (customer connect)
src/app/api/merqo/          — bearer-secret endpoints qkit/loopkit call INTO merqo
src/proxy.ts                — Supabase session refresh + route guard (Next 16)
src/components/landing/     — landing sections (nav, hero, kit-stacker, back-to-top, …)
src/components/dashboard/   — dashboard widgets (stat cards, kit discovery/preview cards)
src/components/section.tsx  — field-group card shell for account-settings-style pages
src/components/image-uploader.tsx — vendor-avatars Storage upload (resize-to-WebP client-side)
src/components/social-icons.tsx / social-links-fields.tsx — shared social-link field list + form
src/hooks/use-async-action.ts — shared pending/error state for server-action buttons
src/lib/kits.ts             — kit family config (landing roadmap source of truth)
src/lib/metrics-client.ts   — fetch of a kit's HTTP metrics endpoint
src/lib/schemas.ts          — Zod schemas for the profile page's forms
src/lib/merqo-vendor-profile.ts — typed wrapper over the shared vendor_profile RPCs
src/lib/supabase/           — browser / server (schema=merqo) / service-role clients
supabase/migrations/        — SQL schema (merqo.* tables) + RLS + grants
```

## Data model

One shared Supabase project, schema per kit. Merqo owns `merqo.*`:
`merqo_team` (team membership), `products` (kit registry + per-product
`metrics_secret`), `vendor_links` (vendor↔kit access, email-keyed),
`billing_settings` (cross-kit pricing levers — currently just the
bundle-discount toggle, public-read, service-role-only write),
`customers` (cross-kit customer identity — phone-keyed OR Telegram-chat-keyed
per vendor since the 2026-08-16 widening, the shared counterpart to
`vendor_profile`, reachable only through `upsert_customer` and three
Telegram-identity SECURITY DEFINER functions, called by qkit/loopkit),
`telegram_link_tokens` (short-lived deep-link tokens for merqo's own
customer-facing Telegram bot, service-role only). Merqo also hosts that
bot's webhook plus two bearer-secret endpoints qkit/loopkit call into —
the first kit → merqo HTTP direction in this codebase (see
`docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`).
RLS default-deny; `products`/`vendor_links` are read/written via the
service-role client only, so `metrics_secret` never reaches a browser.

## Docs

- Changelog: `CHANGELOG.md`
- Deploy runbook: `docs/DEPLOY.md`
- Plans/specs: `docs/superpowers/`
- AI harness/hooks/skills map: `.claude/README.md`

See `AGENTS.md` for full engineering rules, harness details, and skills.
