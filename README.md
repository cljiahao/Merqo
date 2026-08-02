# Merqo

House brand + operator console for a modular family of small-business tools
("kits") for Singapore micro/small sellers. `qkit` (queue/orders), `loopkit`
(stamp-card loyalty), and `paykit` (payments) are live; `shopkit`, `stockkit`,
and `reachkit` are upcoming (see `src/lib/kits.ts`).

This app is the public brand landing plus a role-gated operator console:

- `/dashboard` — cross-product metrics overview (post-login home)
- `/admin/vendors` — grant/revoke kit access per vendor
- `/admin/team` — manage Merqo-team members

Each kit runs its own app on its own schema in a shared Supabase project.
Merqo pulls per-kit metrics over an HTTP API (bearer secret) — it never
queries another kit's schema directly. In production, every kit's auth
cookie is scoped to `.merqo.io` (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`,
`src/lib/supabase/`), so signing in on one kit signs you in on the rest —
unset in dev/preview, where each kit still runs on its own `*.vercel.app`
host. The dashboard's onboarding tour (`src/components/dashboard-tour.tsx`)
stamps its "seen" state as soon as it auto-runs rather than when it
finishes, so a refresh mid-tour can't make it re-trigger on the next load.
The landing footer matches qkit's exactly (single-row wordmark/tagline/
credit-line/sign-in link, no CTA band above it).

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
`metrics_secret`), `vendor_links` (vendor↔kit access, email-keyed).
RLS default-deny; `products`/`vendor_links` are read/written via the
service-role client only, so `metrics_secret` never reaches a browser.

## Docs

- Changelog: `CHANGELOG.md`
- Deploy runbook: `docs/DEPLOY.md`
- Plans/specs: `docs/superpowers/`
- AI harness/hooks/skills map: `.claude/README.md`

See `AGENTS.md` for full engineering rules, harness details, and skills.
