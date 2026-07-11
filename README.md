# Merqo

House brand + operator console for a modular family of small-business tools
("kits") for Singapore micro/small sellers. `qkit` (queue/orders) is the
first live product; `loopkit` (stamp-card loyalty) is the second.

This app is the public brand landing plus a role-gated operator console:

- `/dashboard` — cross-product metrics overview (post-login home)
- `/vendors` — grant/revoke kit access per vendor
- `/team` — manage Merqo-team members

Each kit runs its own app on its own schema in a shared Supabase project.
Merqo pulls per-kit metrics over an HTTP API (bearer secret) — it never
queries another kit's schema directly.

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
src/app/                    — app router (landing, dashboard, server actions)
src/app/page.tsx            — public brand landing (static-prerendered)
src/app/dashboard/          — cross-product metrics overview (auth-gated home)
src/app/vendors/            — grant/revoke vendor kit access (auth-gated)
src/app/team/               — manage Merqo-team members (auth-gated)
src/app/login/              — email/password sign-in
src/proxy.ts                — Supabase session refresh + route guard (Next 16)
src/components/landing/     — landing sections (nav, hero, kit-grid, …)
src/lib/kits.ts             — kit family config (landing roadmap source of truth)
src/lib/metrics-client.ts   — fetch of a kit's HTTP metrics endpoint
supabase/migrations/        — SQL schema (merqo.* tables) + RLS + grants
```

## Data model

One shared Supabase project, schema per kit. Merqo owns `merqo.*`:
`merqo_team` (team membership), `products` (kit registry + per-product
`metrics_secret`), `vendor_links` (vendor↔kit access, email-keyed).
RLS default-deny; `products`/`vendor_links` are read/written via the
service-role client only, so `metrics_secret` never reaches a browser.

## Docs

- Deploy runbook: `docs/DEPLOY.md`
- Plans/specs: `docs/superpowers/`

See `AGENTS.md` for full engineering rules, harness details, and skills.
