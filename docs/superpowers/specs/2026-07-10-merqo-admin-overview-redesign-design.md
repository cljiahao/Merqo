# Admin Overview "Control Tower" Redesign — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** `/admin` (Overview) only — `src/app/admin/page.tsx` and its
sub-components. `/admin/products`, `/admin/vendors`, and `/admin/team` are
explicitly out of scope (confirmed with the user).

## Context

The user flagged the Overview page as "bad for humans to read" — a "wall of
numbers." Read the page and its four sub-components (`StatCard`,
`ProductCard`, `OnboardingFunnelView`, the attention-alerts inline block)
before designing anything:

- **`ProductCard`** (`src/app/admin/product-card.tsx`) renders each live
  product's metrics as a flat 2-column `<dl>` of 7 label/value text rows,
  all the same visual weight. It only distinguishes "ok" (green "Live"
  badge) vs. "not ok" (red reason badge) — it has no concept of the
  "lagging" state that `src/lib/health.ts`'s `classifyHealth` already
  defines and that the separate `/admin/products` page's `ProductHealthCard`
  already uses. Two near-identical-but-inconsistent product cards existing
  across two pages is a real smell, but per the confirmed scope, this spec
  only touches Overview's — `ProductHealthCard` is untouched.
- **`StatCard`** (`src/components/dashboard/stat-card.tsx`) is a bare
  label + big number, no icon, no comparison. Confirmed via grep it is
  used nowhere except this one page — safe to extend its props.
- **The metrics payload already carries `orders_prev_7d`**
  (`src/lib/metrics-schema.ts`) — a real week-over-week comparison point
  that nothing on this page (or anywhere else in the codebase) currently
  reads. This lets the redesign add one genuine trend indicator without
  inventing data or touching any kit's backend.
- **No historical time-series exists anywhere in the metrics contract** —
  only current-window totals. Sparklines/charts were considered and
  rejected: building them would require new fields in every kit's metrics
  endpoint, out of scope for a Merqo-side UI pass.
- **`lucide-react` is already a dependency** (`package.json`) — no new
  package needed for icons.

Two scope-narrowing decisions made with the user before this design:

1. Only `/admin` Overview is in scope, not the other three admin pages.
2. Product tiles' two "headline" (large) metrics are **Revenue (30d)** and
   **Active vendors** — the "is this making money and being used" signal.
   Everything else becomes secondary.

## Goal

Turn the Overview page from a flat list of numbers into a scannable
"control tower": one glance tells you overall system health, the aggregate
numbers that matter, and — per product — whether it's healthy and whether
anything needs action, without reading every row.

## Non-goals

- **No new backend/metrics-contract changes.** Every number shown is
  already in `MetricsPayload` today.
- **No charts or sparklines** (see Context — no historical series exists).
- **No changes to `/admin/products`, `/admin/vendors`, `/admin/team`,**
  including `ProductHealthCard` — confirmed out of scope.
- **No new npm dependencies.**
- **No change to the onboarding funnel's data model** — `OnboardingFunnelView`
  keeps its existing bar-chart shape; only minor visual polish (icon on the
  section header) to match the new visual language, not a rebuild.

## Changes

### `src/lib/format.ts` (extend)

Add a pure, testable trend helper next to the existing `money`:

```ts
export type Trend = { direction: "up" | "down" | "flat"; pct: number | null };

/** Week-over-week (or any current-vs-previous) comparison. `pct` is null
 *  when `previous` is 0 — a percentage change from zero is undefined, and
 *  the UI simply omits the trend in that case rather than showing a
 *  meaningless number. */
export function computeTrend(current: number, previous: number): Trend {
  if (previous === 0) {
    return { direction: current === 0 ? "flat" : "up", pct: null };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: "up", pct };
  if (pct < 0) return { direction: "down", pct: Math.abs(pct) };
  return { direction: "flat", pct: 0 };
}
```

### `src/lib/health.ts` (extend)

Add a pure classifier for the new page-level status banner, alongside the
existing per-product `classifyHealth`:

```ts
export type OverviewHealth = "ok" | "lagging" | "down";

/** Overall status for the page-level banner — worst-case across all
 *  products. `down` (any product unreachable) outranks `lagging` (slow but
 *  reporting), which outranks `ok`. */
export function classifyOverviewHealth(
  downCount: number,
  laggingCount: number,
): OverviewHealth {
  if (downCount > 0) return "down";
  if (laggingCount > 0) return "lagging";
  return "ok";
}
```

### `src/lib/overview.ts` (extend)

Add one aggregate field so the Orders stat card can show a trend too:

- `OverviewTotals` gains `orders_prev_7d: number`.
- `summarizeOverview` sums `d.orders_prev_7d` into it, same loop as the
  existing fields.

### `src/app/admin/status-banner.tsx` (new)

```ts
StatusBanner({ reporting, lagging, down }: { reporting: number; lagging: number; down: number })
```

A single-line, icon-led, color-coded banner replacing the current plain
text caption ("X reporting · Y lagging · Z down"). Uses
`classifyOverviewHealth(down, lagging)` to pick:

- `ok` → success-green background/border, `CheckCircle2` icon, "All N
  products reporting."
- `lagging` → gold background/border, `AlertTriangle` icon, "N reporting ·
  M lagging."
- `down` → destructive background/border, `AlertCircle` icon, "N reporting
  · M lagging · K down." (only the non-zero parts are shown, matching the
  current caption's conditional-clause pattern).

Renders unconditionally (unlike the existing `allDown` empty-state block,
which stays as-is below it — the banner always shows the status; the
empty-state block still only appears when literally nothing is reporting).

### `src/components/dashboard/stat-card.tsx` (extend, backward-compatible)

Add two optional props — existing callers elsewhere (none, per the grep
above) are unaffected, and this page's own callers are updated to use them:

```ts
export function StatCard({
  label,
  value,
  accent = false,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: Trend; // from src/lib/format.ts
});
```

- `Icon`, if given, renders top-right of the card, muted color, `size-4`.
- `trend`, if given AND `trend.pct !== null`, renders next to the value as
  a small `size-3` up/down arrow (`ArrowUp`/`ArrowDown` from lucide) +
  `{pct}%`, colored green (up) / red (down) / muted (flat). Omitted
  entirely when `pct` is null (see `computeTrend`'s doc comment) — no
  placeholder shown for "no meaningful comparison."

### `src/app/admin/page.tsx` (modify)

- Replace the current caption paragraph with `<StatusBanner
reporting={totals.products_reporting} lagging={lagging}
down={totals.products_down} />`.
- Pass icons + the new orders trend into the four existing `StatCard`s:
  `DollarSign` (Revenue), `TrendingUp` (GMV), `Users` (Active vendors),
  `ShoppingCart` (Orders — plus
  `trend={computeTrend(totals.orders_7d, totals.orders_prev_7d)}`).
- Replace `<ProductCard>` usage with `<ProductTile>` (new component below),
  passing `now` through (already computed on this page for the `health`
  array — currently only used to derive the `lagging` count, now also
  threaded into each tile).
- `OnboardingFunnelView`'s section header gets a small icon (`Users` or
  similar) — cosmetic only, no prop/behavior change to that component.

### `src/app/admin/product-tile.tsx` (new, replaces `product-card.tsx`)

Renamed from `ProductCard` — the shape changes enough to warrant a new
name, and it avoids future confusion with the separate, untouched
`ProductHealthCard` on `/admin/products`.

```ts
export function ProductTile({
  name,
  result,
  now,
}: {
  name: string;
  result: MetricsResult;
  now: number;
});
```

**Not-ok branch** (`!result.ok`): unchanged from the current `ProductCard`
— dashed border, reason-based badge (Auth error / Bad response /
Unavailable), "No live metrics right now." text. No regression here; this
branch was already fine.

**Ok branch**: solid border, header row with the kit name and a health
badge computed via `classifyHealth(result, now)` — `"reporting"` (success,
"Reporting") or `"lagging"` (gold, "Lagging"); `"down"` is unreachable here
since `result.ok` is true, mirroring `ProductHealthCard`'s exhaustive-but-
branch-limited usage. This is the concrete fix for the "always says Live"
gap — Overview now shows the same 3-state health `ProductHealthCard`
already shows on the Products page.

If `d.pending_upgrade_requests > 0`, a `Badge variant="gold"` reading "{n}
upgrade request{s}" renders directly under the header row — the one
actionable per-product number gets pulled out of the metric list entirely
into its own visually distinct line.

Two headline numbers, large (`font-display text-2xl font-bold
tabular-nums`, matching `StatCard`'s value styling), each with a small
muted icon and label above: **Revenue (30d)** (`DollarSign`, `money(d.revenue_cents_30d)`) and
**Active vendors** (`Users`, `String(d.active_vendors)`), laid out
side-by-side (`grid grid-cols-2 gap-4`).

Remaining four metrics — GMV (30d), Orders (7d), Signups (7d), Pro vendors
— render as a wrapped row of compact pill chips (`inline-flex items-center
gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs`, muted label

- `font-medium tabular-nums` value), replacing the old 4-remaining-rows of
  the `<dl>`. The Orders chip additionally shows the trend from
  `computeTrend(d.orders_7d, d.orders_prev_7d)` inline (small arrow + `%`,
  same rendering rule as `StatCard`'s trend — omitted when `pct` is null).

## Error handling

No new failure modes — every value rendered already flows through the
existing `MetricsResult`/`OverviewTotals` types, which already model
absence (`!result.ok`) and are already handled by existing branches. The
new `computeTrend` is a pure function with an explicit, tested `previous ===
0` branch so it never divides by zero or renders `NaN%`/`Infinity%`.

## Testing

- **`computeTrend`** (`src/lib/format.ts`): no test file exists yet for
  this lib (`test/lib/format.test.ts` — confirmed absent) — create it.
  Unit tests: increase, decrease, flat (equal, both nonzero), previous
  zero + current zero (flat, null pct), previous zero + current positive
  (up, null pct).
- **`classifyOverviewHealth`** (`src/lib/health.ts`): `test/lib/health.test.ts`
  already exists — extend it. Unit tests: all three branches, plus the
  precedence check (down count > 0 wins even when lagging count is also >
  0).
- **`summarizeOverview`**: `test/lib/overview.test.ts` already exists —
  extend it with an assertion that `orders_prev_7d` sums correctly across
  multiple ok results and is unaffected by not-ok results, matching the
  existing test pattern for the other summed fields.
- **`StatCard`, `StatusBanner`, `ProductTile`**: no dedicated component
  tests — matches this codebase's existing convention (no test file exists
  today for `StatCard`, `ProductCard`, or `OnboardingFunnelView`; only pure
  logic functions get unit tests, UI composition gets manual verification).
  Manual browser verification required per AGENTS.md before considering
  this done: check all three `OverviewHealth` banner states are reachable
  and visually distinct render correctly (can be forced by temporarily
  editing local data or observing real kit states), and that a real
  Pro-tier/upgrade-request vendor scenario renders the gold pill.
- `pnpm check` clean; full suite green.

## Open questions

None blocking.
