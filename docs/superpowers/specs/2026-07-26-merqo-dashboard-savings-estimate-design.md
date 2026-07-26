# Vendor Dashboard Savings Estimate — Design

**Date:** 2026-07-26
**Status:** Approved (brainstorm)
**Scope:** Add an estimated time/money-saved panel to the vendor `/dashboard`
(`src/app/dashboard/(app)/`) — per active kit card, plus a page-level summary —
and a Free→Pro upsell delta. Merqo repo only, estimate-based (no real
per-vendor usage data exists in the metrics pipeline today).

## Context

`/dashboard` (`src/app/dashboard/(app)/page.tsx`) renders a vendor's active
kit tiles (`VendorKitCard`, `src/app/dashboard/(app)/vendor-kit-card.tsx`)
plus pending/discovery sections. Each tile shows name, tagline, plan badge
(Free/Pro), an "Open {kit}" link, and an upgrade/downgrade request button
(`upgrade-button.tsx`/`downgrade-button.tsx`, which file a request — no
self-serve billing toggle exists).

The only usage data Merqo has is the aggregate metrics API
(`src/lib/metrics-client.ts`, `src/lib/metrics-schema.ts`) — one payload per
**kit**, summed across all its vendors (`revenue_cents_30d`, `orders_7d`,
`active_vendors`, etc). There is no per-vendor breakdown anywhere in the
pipeline; building one would mean instrumenting each kit's own repo
(qkit/loopkit/paykit) to key metrics by vendor email — out of scope here.

The goal (per the user) is to make the dashboard read as a "here's what
you're getting" value summary — money and time saved — and to use that same
framing to motivate a Pro upgrade by showing the incremental delta.

## Goal

A vendor viewing `/dashboard` sees, per active kit, an estimated dollar and
hours-per-week value the kit is providing them, plus — for kits they're on
Free for — how much more that would be on Pro. A summary line at the top of
the page totals it across all their active kits.

## Non-goals

- **No real per-vendor metrics.** Numbers are flat per-kit/per-tier
  assumptions, not measured. Everything is labeled "Estimated."
- **No changes to discovery cards** (`KitDiscoveryCard`, "Ready to add"/"Coming
  soon" sections) — savings estimates only appear on cards for kits the
  vendor is already active on.
- **No self-serve billing.** The existing request-based upgrade flow
  (`upgrade-button.tsx` → `requestUpgrade`) is unchanged; this only adds a
  motivating number next to the existing button.
- **No changes to the admin-side aggregate overview** (`src/lib/overview.ts`)
  — this is the vendor-facing `/dashboard` only.

## Assumption numbers

Grounded via research (Singapore hawker-stall wage as the labor-value basis,
industry stats for the mechanism each kit replaces — see citations below),
not fabricated. `$/hour` basis: **S$18/hr**, rounded from the Singapore
hawker-stall staff wage (~S$17.4/hr, Jooble, May 2025) — chosen over the
broader F&B-industry average (~S$24/hr) as the better proxy for the
owner/staff time these kits actually displace at micro/small-seller scale.
`$/month = hrs/week × 4.33 × $18`, rounded to the nearest $10, applied
consistently across kits so the numbers stay internally comparable.

| kit | free hrs/wk | free $/mo | pro hrs/wk | pro $/mo | rationale |
|---|---|---|---|---|---|
| qkit | 3 | $230 | 6 | $470 | QR ordering replaces manual order-taking. Industry case data: ~2.5hr saved per 100 QR orders when QR handles ~50% of volume (Jamezz QR-ordering implementation guide). Pro (multi-queue/analytics) assumed ~2x at higher volume. |
| loopkit | 2 | $150 | 4 | $300 | Manual stamp-card tracking removed (direct time input). Directionally backed by loyalty-program lift stats: members drive 12–18% more incremental revenue/year, repeat customers spend ~67% more (queue-it.com loyalty-program statistics, 2026). Read as "time + program value," not pure labor-hours. |
| paykit | 2 | $150 | 5 | $390 | Automated reconciliation/e-invoicing vs manual. SME automation studies show 10–20hrs/month saved, up to 40% cut in reconciliation time (Fincent), scaled down here for single-stall transaction volume rather than a full SME back office. |

Pro figures are kept at roughly a 2x multiple of Free across all three kits,
since Free-vs-Pro feature gating isn't defined anywhere in this repo yet and
a bigger claimed gap wouldn't be defensible.

These numbers live in one place and are expected to be tuned over time as
real feature gating and (eventually) real usage data become available — see
Open questions.

## Data model — `src/lib/savings.ts`

Pure, unit-tested (same style as `src/lib/funnel.ts`/`overview.ts`):

```ts
export type SavingsAssumption = {
  hoursPerWeek: number;
  costCentsPerMonth: number;
};

export type KitSavingsAssumptions = {
  free: SavingsAssumption;
  pro: SavingsAssumption;
};

export const SAVINGS_ASSUMPTIONS: Record<string, KitSavingsAssumptions>;

export type KitSavings = {
  slug: string;
  hoursPerWeek: number;
  costCentsPerMonth: number;
  /** Extra saved if upgraded to Pro. Zero when already on Pro. */
  upsideHoursPerWeek: number;
  upsideCostCentsPerMonth: number;
};

export function computeVendorSavings(links: VendorLink[]): {
  perKit: KitSavings[];
  totalHoursPerWeek: number;
  totalCostCentsPerMonth: number;
  totalUpsideCostCentsPerMonth: number;
};
```

Only `status === "active"` links with a slug present in `SAVINGS_ASSUMPTIONS`
contribute — a kit with no assumption entry (e.g. a future kit) is skipped
entirely, not zero-filled, so the summary total never silently includes a
kit it has no real basis for.

## UI changes

- **`vendor-kit-card.tsx`** — new `savings?: KitSavings` prop. Under the
  tagline: "Est. **$230** saved this month · ~3 hrs/week back". If
  `tile.plan === "free"` and `savings.upsideCostCentsPerMonth > 0`, a second
  muted line next to `UpgradeButton`: "Pro saves **+$240** more (+3 hrs/week)".
  Cards for kits with no `savings` entry render exactly as today — no layout
  shift, no empty placeholder.
- **`page.tsx`** — compute `computeVendorSavings(links)` once, pass the
  matching `KitSavings` slice into each `VendorKitCard`, and render a new
  `<SavingsSummary totals={...} />` between the `<h1>Your kits</h1>` and the
  tile grid.
- **`SavingsSummary`** (new, `src/app/dashboard/(app)/savings-summary.tsx`) —
  one line/banner: "Est. **$X** saved this month · ~Y hrs/week back across
  your kits", and if `totalUpsideCostCentsPerMonth > 0`: "Upgrade to Pro to
  save **+$Z** more". Renders nothing (not an empty card) if `perKit` is
  empty.
- **Framing** — lead with the dollar figure, hours as the secondary
  humanizing stat (mirrors how Toast IQ leads its ROI messaging with a dollar
  headline and mechanism as supporting detail). Pro upside is always shown as
  an explicit **delta** ("+$240 more"), never a second absolute number, to
  keep the free-tier number and the upgrade pitch visually distinct. The
  word "Estimated" appears once, in `SavingsSummary`'s caption — not repeated
  on every card, to avoid clutter.

## Testing

- `src/lib/savings.test.ts` — `computeVendorSavings`: no active kits (empty
  result), mix of free/pro across kits, an active link to a slug with no
  assumption entry (skipped, doesn't zero-pollute totals), a kit already on
  Pro (upside fields are zero).
- `VendorKitCard` — DOM test that the savings line and Pro-upside line render
  only when `savings`/`plan` conditions are met.
- `SavingsSummary` — DOM test for the totals line and the conditional upgrade
  prompt, and that it renders nothing for an empty `perKit`.
- `pnpm check` + `pnpm build` clean.

## Open questions

None blocking. Two things deliberately deferred, not decided against:

- **Tuning the assumption numbers** as real Free/Pro feature gating gets
  defined per kit — today's table is a defensible starting estimate, not
  final pricing-page copy.
- **Real per-vendor metrics** (Phase 2, out of scope here) — if kits ever
  report per-vendor usage over the metrics API, `computeVendorSavings` could
  be swapped to consume real numbers instead of flat assumptions without
  changing the `VendorKitCard`/`SavingsSummary` UI contract (`KitSavings`
  shape stays the same either way).
