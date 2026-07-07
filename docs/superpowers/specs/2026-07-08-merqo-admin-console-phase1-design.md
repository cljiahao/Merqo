# Merqo Admin Console (Phase 1) — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorm)
**Scope:** Restructure Merqo into a qkit-mirrored dual-audience app (`/dashboard/*` for
vendors, `/admin/*` for the Merqo team) and build **Phase 1: the Merqo-team admin
console** — an all-vendor + all-product control room with a decision-useful overview,
per-product health, and an onboarding funnel. Vendor portal (Phase 2) and suggestion
engine (Phase 3) are framed here but specced separately.

## Context

Today Merqo is a single-audience app: `/dashboard`, `/vendors`, `/team` are all gated by
`requireMerqoTeam()` — they are _already_ the Merqo-team console, just sitting at
top-level routes. Vendors do not log in; they use each kit directly (qkit at
`NEXT_PUBLIC_QKIT_URL`). The RLS in `0001_merqo_core.sql` already stubs a vendor
self-read (`vendor_links_own_select` by JWT email) but no vendor UI consumes it.

The reference implementation is **qkit** (`../qkit`), which runs exactly the shape we
want: `/dashboard/*` gated by vendor entitlement (admins bounce to `/admin`), `/admin/*`
gated by `requireAdmin()`, each with its own layout + section nav. Merqo already owns the
twin primitive: `requireMerqoTeam()`. Phase 1 is therefore ~80% **relocation** of what
exists, plus enrichment.

Research backing (see `deep-research` synthesis, 2026-07-07): the admin overview must be a
curated **highlight reel** for fast decisions ("see the storm coming"), not a
vanity-metric grid; product health is the ops-safety net; the durable asset is the
cross-kit data **graph** under the kits, which `/admin/vendors` (grant/revoke) builds.

## Goal

Give the Merqo team one screen to run the family:

1. **Overview** — headline KPIs across all kits + product-health summary + onboarding
   funnel + an attention inbox. The "open it each morning" screen.
2. **Products** — per-kit performance and live/lagging/down health.
3. **Vendors** — grant/revoke (exists) + a per-vendor detail page.
4. **Team** — manage Merqo-team members (exists, relocated).

## Non-goals (Phase 1)

- **No vendor login / no vendor `/dashboard` rebuild** — that is Phase 2. `/dashboard/*`
  is reserved and stubbed but not built here.
- **No feedback UI** — deferred to Phase 2. Feedback needs a submitter, and vendors have
  no login in Phase 1. The attention inbox instead surfaces real Phase-1 signals:
  waitlist signups + pending upgrade requests (already in the data).
- **No suggestion/optimization engine** — Phase 3.
- **No per-vendor kit metrics endpoint** — Phase 2 (the hybrid vendor summary).
- **No schema change** — Phase 1 runs entirely on existing tables + the HTTP metrics API.
  (One optional persistence table is flagged under Data model, explicitly deferred.)
- Not touching the landing (`/`), `/login`, or qkit.

## Whole-system architecture (framing; only `/admin/*` is built in Phase 1)

One Merqo app, two audiences, split by route namespace — qkit's proven pattern.

```
Merqo app
├── /                 landing (public, unchanged)
├── /login            shared auth (unchanged)
├── /dashboard/*      VENDOR-facing        ← Phase 2. gate: has ≥1 active vendor_links row
│     ├── /            cross-kit highlight strip + kit tiles
│     ├── /kits        add / toggle a product (behaviour-triggered unlock)
│     └── /settings    account
└── /admin/*          MERQO TEAM           ← Phase 1. gate: requireMerqoTeam()
      ├── /            overview: KPIs · health · funnel · attention inbox
      ├── /vendors     grant/revoke (exists) + /admin/vendors/[email] detail
      ├── /products    per-kit performance + health
      └── /team        staff (exists)
```

**Routing / auth:**

- `/admin/*` gated by `requireMerqoTeam()` (unchanged behaviour: no session → `/login`,
  signed-in non-member → `/no-access`, schema/config fault → throw loudly).
- `src/proxy.ts` route guard: replace the `/dashboard`,`/vendors`,`/team` match set with
  `/admin` (prefix). `/dashboard` becomes vendor-gated in Phase 2; until then it does not
  exist as a route.
- Post-login destination: a Merqo-team member lands on `/admin`. (Vendor → `/dashboard`
  wiring lands in Phase 2; today only team logs in.) Add a root/login redirect: if the
  signed-in user is on the team → `/admin`.
- **Data boundary unchanged:** all admin reads run through the **service-role client**
  server-side; `metrics_secret` never crosses to a browser; cross-kit data only over the
  **HTTP metrics API** (`fetchProductMetrics`), never a cross-schema query.

## Phase 1 detail

### Routes & relocation

| New route                | From                  | Change                                                         |
| ------------------------ | --------------------- | -------------------------------------------------------------- |
| `/admin` (overview)      | `/dashboard/page.tsx` | Move; enrich with health + funnel + inbox                      |
| `/admin/vendors`         | `/vendors/page.tsx`   | Move as-is; add per-vendor detail link                         |
| `/admin/vendors/[email]` | —                     | New: one vendor's kits/status + inline grant/revoke            |
| `/admin/products`        | —                     | New: per-kit performance + health                              |
| `/admin/team`            | `/team/page.tsx`      | Move as-is                                                     |
| `/admin/layout.tsx`      | —                     | New: `requireMerqoTeam()` + header + `AdminNav` (qkit pattern) |

Old top-level `/dashboard`, `/vendors`, `/team` route dirs are removed after the move
(their `loading.tsx` states move with them).

### Overview (`/admin`)

Composed from `listLiveProducts()` → `fetchProductMetrics()` (per product, in parallel) →
`summarizeOverview()`, exactly as the current dashboard, plus:

- **KPI band** (reuse `StatCard`): Revenue (all), GMV·30d, Active vendors, Orders·7d (with
  Δ vs `orders_prev_7d`), Signups·7d, plus a **Products reporting / down** health chip.
  A small, opinionated set — not configurable.
- **Onboarding funnel** (new `OnboardingFunnel` view, mirroring qkit's
  `ActivationFunnelView`): **Waitlisted → Granted → Using**, derived by a pure
  `onboardingFunnel()` over `vendor_links` (waitlist vs active counts) + kits' reported
  `active_vendors`. Bars + step-conversion %.
- **Attention inbox** (bell, qkit pattern): count = waitlisted `vendor_links` +
  `totals.pending_upgrade_requests`. Lists the actionable items.

### Products (`/admin/products`)

One card per kit: name, registry status (`live`/`coming_soon`), **health badge**
(reporting / lagging / down), **last-seen** (`generated_at` from the payload), request
latency, `active_vendors`, `revenue_cents_30d`, `orders_7d` with Δ. This is the
"is anything broken, and which kit is slipping" view.

### Vendors (`/admin/vendors` + `/admin/vendors/[email]`)

- Index: unchanged grant/revoke (`listVendorGrants`, `grantKit`, `revokeKit`,
  `GrantForm`, `RevokeButton`), each vendor row links to detail.
- Detail (`[email]`): that vendor's kits + statuses (from `listVendorGrants` filtered, or
  a scoped read), with inline grant/revoke. Email is the key (URL-encoded).

## Phase 1 data model

**No new tables.** Everything derives from existing state:

- **Product health** is computed **live** per request. Extend `fetchProductMetrics` to
  also return `durationMs` (wrap the existing `fetch` timing). A pure
  `classifyHealth(result, durationMs, generatedAt, now)` returns
  `"reporting" | "lagging" | "down"`:
  - `down` — `!result.ok` (any `reason`: auth / unreachable / bad_shape).
  - `lagging` — ok but slow (`durationMs` over a threshold, e.g. ≥2000ms while timeout is
    5000ms) **or** stale (`generated_at` older than a freshness window).
  - `reporting` — ok, fast, fresh.
- **Onboarding funnel** derives from `vendor_links.status` counts + kits' `active_vendors`.
- **(Deferred, not Phase 1)** a `merqo.product_health_samples` table to persist pings for
  _trend_ and true _last-seen across restarts_. Live compute is sufficient for v1; add the
  table (new migration) only when a health timeline is wanted.

## Components

Reuse existing + qkit patterns; Merqo stays the host shell each kit plugs into.

- **New:** `src/app/admin/layout.tsx`, `src/app/admin/admin-nav.tsx` (client, `usePathname`
  active tab — qkit's `AdminNav`), `src/app/admin/onboarding-funnel.tsx`,
  `src/app/admin/products/page.tsx` + a `product-health-card.tsx`,
  `src/app/admin/vendors/[email]/page.tsx`.
- **New pure lib:** `src/lib/health.ts` (`classifyHealth`), and an
  `onboardingFunnel()` (in `src/lib/overview.ts` or a new `src/lib/funnel.ts`).
- **Reuse/relocate:** `StatCard`, `ProductCard`, `GrantForm`, `RevokeButton`,
  `add-team-form`, `remove-member`, the header (repurpose `DashHeader` → an admin header
  hosting `AdminNav`), `summarizeOverview`, `listLiveProducts`, `listVendorGrants`,
  `listProducts`, `listTeamMembers`.
- **Extend:** `fetchProductMetrics` (+`durationMs`), `MetricsResult` type,
  `OverviewTotals` if the funnel needs an extra field.

## Error handling

Degraded metrics are already first-class: a per-product failure yields a `down` card and
never breaks the page; the all-down case shows the existing "Metrics unavailable" state.
Health classification makes partial degradation (one lagging kit) visible instead of
silent. Config faults (schema not exposed → PGRST106) keep throwing loudly via
`requireMerqoTeam` / the service-client read helpers — never a silent empty screen.

## Testing

- **Vitest (pure):** `classifyHealth` (each branch: down reasons, lagging by latency,
  lagging by staleness, healthy), `onboardingFunnel` (empty, waitlist-only, mixed),
  extended `summarizeOverview`. Follows the existing `groupVendorGrants` test style.
- **Playwright smoke:** `/admin` requires team (signed-out → `/login`); non-member →
  `/no-access`; landing/login still public.
- `pnpm check` + `/next-verify` green before done.

## templateCentral usage

Per AGENTS.md, templateCentral has **no Supabase support** — do **not** run
`templatecentral:add(auth|database)` or the scaffolders (they install better-auth/Drizzle
and break RLS). Use only the stack-agnostic **`templatecentral:standards`** to check
naming / validation / full-stack-type drift on the new code after implementation.

## Future phases (specced separately)

- **Phase 2 — Vendor portal (hybrid).** `/dashboard` cross-kit highlight strip + kit
  tiles + `/dashboard/kits` (behaviour-triggered unlock, 1-click with consent) +
  `/dashboard/settings`. Requires each kit to expose a small **per-vendor summary**
  endpoint (`?email=`, bearer) — qkit first — and vendors to get Supabase accounts
  (`vendor_links` is already email-keyed; `vendor_links_own_select` already permits
  self-read). Feedback UI lands here.
- **Phase 3 — Suggestion engine.** Rules-based alerts over the cross-kit graph (fees
  eating margin, reorder, queue overflow), surfaced to vendors (their own) and admin
  (across all — the predictive layer). Rules first, not ML (research refuted the
  "AI-insight moat" claim 0–3).

## Open questions

- Health thresholds (lagging latency ms, freshness window) — pick sensible defaults in
  implementation, make them named constants, tune with real data.
- `/admin/vendors/[email]` keying — plain URL-encoded email vs a hashed slug; default to
  URL-encoded email unless it complicates routing.
