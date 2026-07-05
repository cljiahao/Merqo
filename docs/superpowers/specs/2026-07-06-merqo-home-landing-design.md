# Merqo Home / Brand Landing — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm)
**Scope:** Replace the default create-next-app root with a public brand landing that explains Merqo and shows the kit roadmap. Bundle boilerplate cleanup + cheap code-health refactors surfaced by audit.

## Goal

`/` is public (only `/team` + `/products` are auth-gated). Today it's create-next-app boilerplate. Ship a credible public brand landing that:

1. Explains what Merqo is (house brand for modular SG small-business tools).
2. Shows the kit family roadmap — what's live (qkit) vs coming (loopkit, shopkit).
3. Drives vendors to qkit and captures waitlist emails for coming kits.

Audience: non-technical SG micro/small vendors + curious visitors.

## Non-goals

- No auth on the landing. No pricing/checkout. No Stripe.
- Not touching qkit, migrations of existing tables, or team/vendor business logic beyond the four named refactors.
- Generated Supabase DB types + auth-gate test coverage are flagged but deferred (types need a live DB connection — do during provisioning).

## Architecture

**Server Component landing, near-zero client JS.** Only the waitlist form is `"use client"`. LCP (hero heading) renders in initial HTML — no client fetch above the fold. The landing does **no DB read for display**, so it renders even while Supabase is half-provisioned (directly fixes the current failure mode).

### Data

- **Kit family = static config** in `src/lib/kits.ts` — array of `{ slug, name, tagline, status: 'live'|'coming'|'planned', href? }`. Rarely changes; static keeps LCP fast and decouples the landing from DB state.
- **Waitlist = the only write.** Server action posts a Zod-validated email + kit slug, upserts into `merqo.vendor_links` via the service client (bypasses RLS; server-only secret). Requires `loopkit` + `shopkit` rows in `merqo.products` for the FK — added by a new seed migration.

### Components (new)

- `src/app/page.tsx` — server landing, composes the sections.
- `src/components/landing/nav.tsx`, `hero.tsx`, `benefits.tsx`, `kit-grid.tsx`, `kit-card.tsx`, `how-it-works.tsx`, `cta.tsx`, `footer.tsx` — server components.
- `src/components/landing/waitlist-form.tsx` — `"use client"`, the only client bit.
- `src/components/ui/button.tsx`, `card.tsx` — shadcn (new-york, mirrors qkit), + `src/lib/utils.ts` `cn`.
- `src/app/(vendor)/products/actions.ts` pattern reused for the waitlist server action (`src/app/actions/waitlist.ts`).

### Section order (research consensus)

Nav → Hero (headline + subhead + one CTA) → Trust strip → What Merqo is (3 benefits) → **Kit family grid (= the roadmap, status badges + waitlist)** → How it works (qkit, 3 steps) → Closing CTA (+ sticky mobile CTA) → Footer. No carousel, no feature walls, one primary CTA per section.

### Stack additions

`lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui` (shadcn deps, versions matched to qkit). `components.json` mirrors qkit (new-york, rsc, neutral base). merqo-branded theme tokens added to `globals.css` (own identity — trustworthy/commerce, distinct from qkit's food-stall warmth). `next/font` already present (Geist).

## Performance + a11y (baked in)

- RSC-first; `next/image` with `priority` on hero art, explicit width/height (no CLS), lazy below-fold; `next/font` swap + subset.
- Targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 (p75).
- One `h1`; nested headings; text contrast ≥4.5:1; visible keyboard focus; semantic `nav`/`main`/`footer`; labeled waitlist field; `alt` on images; respect `prefers-reduced-motion`.

## Cleanup

- Delete boilerplate: `public/{file,globe,window,next,vercel}.svg`.
- Replace boilerplate `src/app/page.tsx`; fix `layout.tsx` metadata (`Create Next App` → Merqo title/description).
- Remove `.superpowers/` from the repo (tracked planning scratch — safe).
- `.next/` + `tsconfig.tsbuildinfo` already gitignored — left alone.

## Refactors (from audit — cheap, bundled)

1. `src/lib/vendor.ts` — two independent awaits → `Promise.all` (latency).
2. Duplicated `money` helper (`team/page.tsx` + `team/product-card.tsx`) → extract to `src/lib/format.ts`.
3. Duplicated `RegistryRow` type (`products.ts` + `metrics-client.ts`) → single source.
4. `requireMerqoTeam` unguarded `getUser()` → try/catch degrade like `middleware.ts` (avoid 500 on auth blip).

## Seed migration

`supabase/migrations/0002_coming_kits.sql` — insert `loopkit` + `shopkit` rows into `merqo.products` (status `coming_soon`), idempotent (`on conflict (slug) do nothing`). Backs the waitlist FK.

## Testing (keep 24/24 green)

- Unit: `kits.ts` config shape; waitlist action (valid email upserts, invalid rejects, service-client path).
- Keep existing suite green; run `pnpm vitest run` + `pnpm build` + `pnpm lint` before commit.

## Commits

Small, conventional, per logical unit (deps+ui → theme → kits config → waitlist action+test → landing sections → cleanup → refactors → seed migration). No qkit changes.
