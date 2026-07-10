# Admin Overview "Control Tower" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin` (Overview) from a flat wall of numbers into a scannable control tower — a color-coded status banner, icon-led stat cards with a real week-over-week trend, and per-product tiles with a genuine 3-state health badge and tiered (headline vs. secondary) metrics.

**Architecture:** Three small pure-logic additions (`computeTrend` in `src/lib/format.ts`, `classifyOverviewHealth` in `src/lib/health.ts`, one new aggregate field in `src/lib/overview.ts`), each unit-tested in isolation. Then three presentational pieces (`StatCard` extended, new `StatusBanner`, new `ProductTile` replacing `ProductCard`) that consume them. `src/app/admin/page.tsx` wires everything together last. No new dependencies — `lucide-react` is already installed and unused elsewhere for icons.

**Tech Stack:** Next.js 16 Server Components, Tailwind v4, `lucide-react`, Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- No new npm dependencies (spec Non-goals).
- No changes to `/admin/products`, `/admin/vendors`, `/admin/team`, or `ProductHealthCard` (spec Non-goals — confirmed out of scope with the user).
- No new backend/metrics-contract fields — every value used must already exist in `MetricsPayload` (`src/lib/metrics-schema.ts`).
- `computeTrend`'s `pct` is `null` when `previous` is 0 — never render a percentage in that case, never divide by zero.
- Product tiles' two large "headline" metrics are Revenue (30d) and Active vendors — confirmed with the user; everything else is secondary.
- No dedicated component tests for `StatCard`, `StatusBanner`, `ProductTile`, or the `onboarding-funnel.tsx` polish — matches this codebase's existing convention (no test file exists today for `StatCard`, `ProductCard`, or `OnboardingFunnelView`). Manual browser verification is required before considering the UI tasks done.

---

### Task 1: `computeTrend` — pure trend helper + test

**Files:**

- Modify: `src/lib/format.ts`
- Create: `test/lib/format.test.ts`

**Interfaces:**

- Consumes: nothing (pure function, two numbers).
- Produces: `export type Trend = { direction: "up" | "down" | "flat"; pct: number | null };` and `export function computeTrend(current: number, previous: number): Trend` — consumed by Task 4 (`StatCard`) and Task 6 (`ProductTile`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/format.test.ts
import { describe, it, expect } from "vitest";
import { computeTrend } from "@/lib/format";

describe("computeTrend", () => {
  it("reports an increase", () => {
    expect(computeTrend(120, 100)).toEqual({ direction: "up", pct: 20 });
  });

  it("reports a decrease", () => {
    expect(computeTrend(80, 100)).toEqual({ direction: "down", pct: 20 });
  });

  it("reports flat when unchanged and nonzero", () => {
    expect(computeTrend(50, 50)).toEqual({ direction: "flat", pct: 0 });
  });

  it("reports flat with a null pct when both are zero", () => {
    expect(computeTrend(0, 0)).toEqual({ direction: "flat", pct: null });
  });

  it("reports up with a null pct when previous is zero but current is not", () => {
    expect(computeTrend(5, 0)).toEqual({ direction: "up", pct: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/format.test.ts`
Expected: FAIL — `computeTrend is not exported` (or `is not a function`)

- [ ] **Step 3: Write minimal implementation**

Add to the end of `src/lib/format.ts` (leave the existing `money` export untouched):

```typescript
export type Trend = { direction: "up" | "down" | "flat"; pct: number | null };

/** Week-over-week (or any current-vs-previous) comparison. `pct` is null
 *  when `previous` is 0 — a percentage change from zero is undefined, and
 *  callers should omit the trend display in that case rather than show a
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/format.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts test/lib/format.test.ts
git commit -m "feat: add computeTrend for week-over-week comparisons"
```

---

### Task 2: `classifyOverviewHealth` — pure page-level status classifier + test

**Files:**

- Modify: `src/lib/health.ts`
- Modify: `test/lib/health.test.ts`

**Interfaces:**

- Consumes: nothing (pure function, two numbers).
- Produces: `export type OverviewHealth = "ok" | "lagging" | "down";` and `export function classifyOverviewHealth(downCount: number, laggingCount: number): OverviewHealth` — consumed by Task 5 (`StatusBanner`).

- [ ] **Step 1: Write the failing test**

Append to `test/lib/health.test.ts` (add this import to the existing `import { classifyHealth, LAGGING_MS, FRESHNESS_MS } from "@/lib/health";` line — change it to also import `classifyOverviewHealth`):

```typescript
import {
  classifyHealth,
  classifyOverviewHealth,
  LAGGING_MS,
  FRESHNESS_MS,
} from "@/lib/health";
```

Add this new `describe` block at the end of the file:

```typescript
describe("classifyOverviewHealth", () => {
  it("is ok when nothing is lagging or down", () => {
    expect(classifyOverviewHealth(0, 0)).toBe("ok");
  });

  it("is lagging when something is lagging but nothing is down", () => {
    expect(classifyOverviewHealth(0, 2)).toBe("lagging");
  });

  it("is down when anything is down, even if something is also lagging", () => {
    expect(classifyOverviewHealth(1, 0)).toBe("down");
    expect(classifyOverviewHealth(1, 3)).toBe("down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/health.test.ts`
Expected: FAIL — `classifyOverviewHealth is not exported` (or `is not a function`)

- [ ] **Step 3: Write minimal implementation**

Add to the end of `src/lib/health.ts`:

```typescript
export type OverviewHealth = "ok" | "lagging" | "down";

/** Overall status for the page-level banner — worst case across all
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/health.test.ts`
Expected: PASS (8 tests: 5 existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/health.ts test/lib/health.test.ts
git commit -m "feat: add classifyOverviewHealth for the admin status banner"
```

---

### Task 3: `orders_prev_7d` aggregate on `OverviewTotals` + test

**Files:**

- Modify: `src/lib/overview.ts`
- Modify: `test/lib/overview.test.ts`

**Interfaces:**

- Consumes: nothing new — `MetricsResult`/`MetricsPayload` already carry `orders_prev_7d` (`src/lib/metrics-schema.ts`).
- Produces: `OverviewTotals` gains `orders_prev_7d: number` — consumed by Task 7 (`src/app/admin/page.tsx`, via `computeTrend(totals.orders_7d, totals.orders_prev_7d)`).

- [ ] **Step 1: Write the failing test**

Extend the existing test in `test/lib/overview.test.ts` — replace the whole file with:

```typescript
// test/lib/overview.test.ts
import { describe, it, expect } from "vitest";
import { summarizeOverview } from "@/lib/overview";
import type { MetricsResult } from "@/lib/metrics-client";
import type { MetricsPayload } from "@/lib/metrics-schema";

const ok = (slug: string, over: Partial<MetricsPayload>): MetricsResult => {
  const data: MetricsPayload = {
    product: slug,
    generated_at: "t",
    revenue_cents_30d: 0,
    revenue_cents_all: 0,
    gmv_cents_30d: 0,
    active_vendors: 0,
    orders_7d: 0,
    orders_prev_7d: 0,
    signups_7d: 0,
    pro_vendors: 0,
    total_vendors: 0,
    pending_upgrade_requests: 0,
    funnel: { signed_up: 0, with_booth: 0, with_order: 0, pro: 0 },
    ...over,
  };
  return { ok: true, product: slug, data, durationMs: 0 };
};

describe("summarizeOverview", () => {
  it("sums numeric fields across ok products and ignores failed ones", () => {
    const results: MetricsResult[] = [
      ok("qkit", {
        revenue_cents_all: 1000,
        active_vendors: 3,
        pending_upgrade_requests: 2,
        orders_7d: 5,
        orders_prev_7d: 4,
      }),
      ok("loopkit", {
        revenue_cents_all: 500,
        active_vendors: 2,
        pending_upgrade_requests: 1,
        orders_7d: 4,
        orders_prev_7d: 6,
      }),
      { ok: false, product: "down", reason: "unreachable", durationMs: 0 },
    ];
    const t = summarizeOverview(results);
    expect(t.revenue_cents_all).toBe(1500);
    expect(t.active_vendors).toBe(5);
    expect(t.pending_upgrade_requests).toBe(3);
    expect(t.orders_7d).toBe(9);
    expect(t.orders_prev_7d).toBe(10);
    expect(t.products_reporting).toBe(2);
    expect(t.products_down).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/overview.test.ts`
Expected: FAIL — `t.orders_prev_7d` is `undefined`, assertion fails (expected 10, got undefined)

- [ ] **Step 3: Write minimal implementation**

In `src/lib/overview.ts`, add `orders_prev_7d: number;` to the `OverviewTotals` type (next to the existing `orders_7d: number;` line), add `orders_prev_7d: 0,` to the initializer object in `summarizeOverview` (next to the existing `orders_7d: 0,` line), and add `t.orders_prev_7d += d.orders_prev_7d;` to the summing loop (next to the existing `t.orders_7d += d.orders_7d;` line). The full file after the change:

```typescript
import type { MetricsResult } from "@/lib/metrics-client";

export type OverviewTotals = {
  revenue_cents_all: number;
  revenue_cents_30d: number;
  gmv_cents_30d: number;
  active_vendors: number;
  orders_7d: number;
  orders_prev_7d: number;
  signups_7d: number;
  pro_vendors: number;
  total_vendors: number;
  pending_upgrade_requests: number;
  products_reporting: number;
  products_down: number;
};

export function summarizeOverview(results: MetricsResult[]): OverviewTotals {
  const t: OverviewTotals = {
    revenue_cents_all: 0,
    revenue_cents_30d: 0,
    gmv_cents_30d: 0,
    active_vendors: 0,
    orders_7d: 0,
    orders_prev_7d: 0,
    signups_7d: 0,
    pro_vendors: 0,
    total_vendors: 0,
    pending_upgrade_requests: 0,
    products_reporting: 0,
    products_down: 0,
  };
  for (const r of results) {
    if (!r.ok) {
      t.products_down += 1;
      continue;
    }
    t.products_reporting += 1;
    const d = r.data;
    t.revenue_cents_all += d.revenue_cents_all;
    t.revenue_cents_30d += d.revenue_cents_30d;
    t.gmv_cents_30d += d.gmv_cents_30d;
    t.active_vendors += d.active_vendors;
    t.orders_7d += d.orders_7d;
    t.orders_prev_7d += d.orders_prev_7d;
    t.signups_7d += d.signups_7d;
    t.pro_vendors += d.pro_vendors;
    t.total_vendors += d.total_vendors;
    t.pending_upgrade_requests += d.pending_upgrade_requests;
  }
  return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/overview.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/overview.ts test/lib/overview.test.ts
git commit -m "feat: aggregate orders_prev_7d in overview totals"
```

---

### Task 4: Extend `StatCard` with an optional icon + trend

**Files:**

- Modify: `src/components/dashboard/stat-card.tsx`

**Interfaces:**

- Consumes: `Trend` type from Task 1 (`@/lib/format`).
- Produces: `StatCard` gains two optional props, `icon` and `trend` — both backward-compatible (existing call sites omit them and render exactly as before). Consumed by Task 7 (`src/app/admin/page.tsx`).

- [ ] **Step 1: Replace the file**

`StatCard` currently has no props beyond `label`/`value`/`accent`. Replace the full contents of `src/components/dashboard/stat-card.tsx` with:

```tsx
import type { ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/format";

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
  icon?: ComponentType<{ className?: string }>;
  trend?: Trend;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight tabular-nums",
            accent && "text-primary",
          )}
        >
          {value}
        </div>
        {trend && trend.pct !== null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trend.direction === "up" && "text-primary",
              trend.direction === "down" && "text-destructive",
              trend.direction === "flat" && "text-muted-foreground",
            )}
          >
            {trend.direction === "up" && <ArrowUp className="size-3" />}
            {trend.direction === "down" && <ArrowDown className="size-3" />}
            {trend.pct}%
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean — this is a prop-superset change, no existing caller in the repo passes `icon`/`trend` yet (that happens in Task 7), so nothing else should need updating.

Run: `pnpm vitest run`
Expected: all existing tests still pass (no test file exists for this component; unaffected suites stay green)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/stat-card.tsx
git commit -m "feat: add optional icon and trend indicator to StatCard"
```

---

### Task 5: `StatusBanner` — new page-level status component

**Files:**

- Create: `src/app/admin/status-banner.tsx`

**Interfaces:**

- Consumes: `classifyOverviewHealth` from Task 2 (`@/lib/health`).
- Produces: `StatusBanner({ reporting, lagging, down }: { reporting: number; lagging: number; down: number })` — consumed by Task 7 (`src/app/admin/page.tsx`), replacing the current plain-text caption.

- [ ] **Step 1: Write the component**

```tsx
// src/app/admin/status-banner.tsx
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { classifyOverviewHealth } from "@/lib/health";

/** Single-line, color-coded, icon-led status for the whole product
 *  ecosystem — replaces a plain-text caption so the overall picture is
 *  visible without reading numbers. */
export function StatusBanner({
  reporting,
  lagging,
  down,
}: {
  reporting: number;
  lagging: number;
  down: number;
}) {
  const status = classifyOverviewHealth(down, lagging);

  if (status === "down") {
    const parts = [`${reporting} reporting`];
    if (lagging > 0) parts.push(`${lagging} lagging`);
    parts.push(`${down} down`);
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
        <AlertCircle className="size-5 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {parts.join(" · ")}
        </p>
      </div>
    );
  }

  if (status === "lagging") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <AlertTriangle className="size-5 shrink-0 text-gold-foreground" />
        <p className="text-sm font-medium text-gold-foreground">
          {reporting} reporting · {lagging} lagging
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
      <CheckCircle2 className="size-5 shrink-0 text-primary" />
      <p className="text-sm font-medium text-primary">
        All {reporting} products reporting
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: all tests pass (no dedicated test for this component — matches the codebase's convention of not testing presentational-only pieces; the logic it depends on, `classifyOverviewHealth`, is already unit-tested in Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/status-banner.tsx
git commit -m "feat: add StatusBanner for the admin overview page"
```

---

### Task 6: `ProductTile` — replaces `ProductCard`

**Files:**

- Create: `src/app/admin/product-tile.tsx`
- Delete: `src/app/admin/product-card.tsx`

**Interfaces:**

- Consumes: `classifyHealth`, `HealthStatus` from `@/lib/health` (existing); `money`, `computeTrend` from `@/lib/format` (Task 1 adds `computeTrend`); `Badge` from `@/components/ui/badge` (existing); `MetricsResult` from `@/lib/metrics-client` (existing).
- Produces: `ProductTile({ name, result, now }: { name: string; result: MetricsResult; now: number })` — consumed by Task 7 (`src/app/admin/page.tsx`), replacing `ProductCard`.

- [ ] **Step 1: Write the new component**

```tsx
// src/app/admin/product-tile.tsx
import { ArrowDown, ArrowUp, DollarSign, Users } from "lucide-react";
import type { MetricsResult } from "@/lib/metrics-client";
import { classifyHealth, type HealthStatus } from "@/lib/health";
import { money, computeTrend } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const HEALTH: Record<
  HealthStatus,
  { label: string; variant: "success" | "gold" | "destructive" }
> = {
  reporting: { label: "Reporting", variant: "success" },
  lagging: { label: "Lagging", variant: "gold" },
  down: { label: "Down", variant: "destructive" },
};

export function ProductTile({
  name,
  result,
  now,
}: {
  name: string;
  result: MetricsResult;
  now: number;
}) {
  if (!result.ok) {
    const label =
      result.reason === "auth"
        ? "Auth error"
        : result.reason === "bad_shape"
          ? "Bad response"
          : "Unavailable";
    return (
      <div className="rounded-xl border border-dashed bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{name}</h3>
          <Badge variant="destructive">{label}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          No live metrics right now.
        </p>
      </div>
    );
  }

  const d = result.data;
  const badge = HEALTH[classifyHealth(result, now)];
  const ordersTrend = computeTrend(d.orders_7d, d.orders_prev_7d);
  const chips: [string, string][] = [
    ["GMV (30d)", money(d.gmv_cents_30d)],
    ["Signups (7d)", String(d.signups_7d)],
    ["Pro vendors", String(d.pro_vendors)],
  ];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{name}</h3>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {d.pending_upgrade_requests > 0 && (
        <Badge variant="gold" className="mt-2">
          {d.pending_upgrade_requests} upgrade request
          {d.pending_upgrade_requests === 1 ? "" : "s"}
        </Badge>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <DollarSign className="size-3.5" />
            Revenue (30d)
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            {money(d.revenue_cents_30d)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" />
            Active vendors
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            {d.active_vendors}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
          <span className="text-muted-foreground">Orders (7d)</span>
          <span className="font-medium tabular-nums">{d.orders_7d}</span>
          {ordersTrend.pct !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                ordersTrend.direction === "up" && "text-primary",
                ordersTrend.direction === "down" && "text-destructive",
                ordersTrend.direction === "flat" && "text-muted-foreground",
              )}
            >
              {ordersTrend.direction === "up" && <ArrowUp className="size-3" />}
              {ordersTrend.direction === "down" && (
                <ArrowDown className="size-3" />
              )}
              {ordersTrend.pct}%
            </span>
          )}
        </span>
        {chips.map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
          >
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium tabular-nums">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old component**

```bash
git rm src/app/admin/product-card.tsx
```

(This will leave `src/app/admin/page.tsx` referencing the now-deleted `ProductCard` — that's expected and fixed in Task 7. `pnpm check` will fail until Task 7 lands; that's fine, this task's own verification is scoped to the new file below.)

- [ ] **Step 3: Verify the new file in isolation**

Run: `pnpm exec tsc --noEmit -p . 2>&1 | grep product-tile` — expect no output for `product-tile.tsx` itself (errors about `page.tsx` still importing the deleted `product-card.tsx` are expected at this point and will disappear after Task 7).

Run: `pnpm exec eslint src/app/admin/product-tile.tsx`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/product-tile.tsx
git commit -m "feat: add ProductTile with tiered metrics and 3-state health, replacing ProductCard"
```

---

### Task 7: Wire everything into the Overview page

**Files:**

- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/onboarding-funnel.tsx`

**Interfaces:**

- Consumes: `StatusBanner` (Task 5), `ProductTile` (Task 6), `computeTrend` (Task 1), the extended `StatCard` (Task 4), `orders_prev_7d` on `OverviewTotals` (Task 3) — all already committed.
- Produces: the finished page. Nothing downstream consumes this task.

- [ ] **Step 1: Update imports in `src/app/admin/page.tsx`**

Replace the import block at the top of the file:

```tsx
import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { listVendorGrants } from "@/lib/admin";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { classifyHealth } from "@/lib/health";
import { onboardingFunnel } from "@/lib/funnel";
import { money } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingFunnelView } from "./onboarding-funnel";
import { ProductCard } from "./product-card";
```

with:

```tsx
import Link from "next/link";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { listVendorGrants } from "@/lib/admin";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { classifyHealth } from "@/lib/health";
import { onboardingFunnel } from "@/lib/funnel";
import { money, computeTrend } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingFunnelView } from "./onboarding-funnel";
import { ProductTile } from "./product-tile";
import { StatusBanner } from "./status-banner";
```

- [ ] **Step 2: Replace the header block**

Replace:

```tsx
<div>
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    Internal
  </p>
  <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>
  <p className="mt-1 text-sm text-muted-foreground">
    {totals.products_reporting} reporting
    {lagging > 0 ? ` · ${lagging} lagging` : ""}
    {totals.products_down > 0 ? ` · ${totals.products_down} down` : ""}
  </p>
</div>
```

with:

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Overview
        </h1>
      </div>

      <StatusBanner
        reporting={totals.products_reporting}
        lagging={lagging}
        down={totals.products_down}
      />
```

- [ ] **Step 3: Add icons and the orders trend to the stat cards**

Replace:

```tsx
<section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
  <StatCard
    label="Revenue (all)"
    value={money(totals.revenue_cents_all)}
    accent
  />
  <StatCard label="GMV (30d)" value={money(totals.gmv_cents_30d)} />
  <StatCard label="Active vendors" value={String(totals.active_vendors)} />
  <StatCard label="Orders (7d)" value={String(totals.orders_7d)} />
</section>
```

with:

```tsx
<section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
  <StatCard
    label="Revenue (all)"
    value={money(totals.revenue_cents_all)}
    accent
    icon={DollarSign}
  />
  <StatCard
    label="GMV (30d)"
    value={money(totals.gmv_cents_30d)}
    icon={TrendingUp}
  />
  <StatCard
    label="Active vendors"
    value={String(totals.active_vendors)}
    icon={Users}
  />
  <StatCard
    label="Orders (7d)"
    value={String(totals.orders_7d)}
    icon={ShoppingCart}
    trend={computeTrend(totals.orders_7d, totals.orders_prev_7d)}
  />
</section>
```

- [ ] **Step 4: Swap `ProductCard` for `ProductTile`**

Replace:

```tsx
<section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
  {products.map((p, i) => (
    <ProductCard key={p.slug} name={p.name} result={results[i]} />
  ))}
</section>
```

with:

```tsx
<section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
  {products.map((p, i) => (
    <ProductTile key={p.slug} name={p.name} result={results[i]} now={now} />
  ))}
</section>
```

- [ ] **Step 5: Add an icon to the onboarding funnel's section header**

In `src/app/admin/onboarding-funnel.tsx`, add the import:

```tsx
import type { OnboardingCounts } from "@/lib/funnel";
import { Users } from "lucide-react";
```

and replace:

```tsx
<h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  Onboarding
</h2>
```

with:

```tsx
<h2 className="mb-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  <Users className="size-3.5" />
  Onboarding
</h2>
```

- [ ] **Step 6: Manual browser verification**

Run: `pnpm dev`, sign in as a Merqo-team member, open `/admin`.

Expected:

- A colored status banner appears below "Overview" instead of the old plain-text caption. With the current live registry (qkit reporting normally), it should read green: "All 1 products reporting" (or however many are live at test time).
- The four stat cards show a small muted icon top-right; the Orders (7d) card shows a colored up/down arrow + percentage next to the number if `orders_prev_7d` is nonzero for the current data, or no trend indicator if it's zero.
- The onboarding funnel's "Onboarding" header now has a small icon next to it.
- Each product tile shows: kit name + a health badge (Reporting/Lagging/Down — confirm it says "Reporting" for a healthy kit, not just "Live"), two large numbers (Revenue 30d, Active vendors) each with a small label icon, and a row of compact pill chips below (GMV, Orders w/ trend if applicable, Signups, Pro vendors). If the test vendor/kit has pending upgrade requests, a gold pill appears under the kit name before the metrics.
- A kit reporting an error still shows the old dashed-border "No live metrics right now" treatment, unchanged.

- [ ] **Step 7: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean — this is the point where the `ProductCard` deletion from Task 6 is fully resolved; there must be zero remaining references to `./product-card` or `ProductCard` anywhere in the repo.

Run: `pnpm vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/onboarding-funnel.tsx
git commit -m "feat: wire the control-tower redesign into the admin overview page"
```

---

## Self-Review Notes

- **Spec coverage:** every `## Changes` subsection in the design spec (`src/lib/format.ts`, `src/lib/health.ts`, `src/lib/overview.ts`, `src/app/admin/status-banner.tsx`, `src/components/dashboard/stat-card.tsx`, `src/app/admin/page.tsx`, `src/app/admin/product-tile.tsx`) maps to Tasks 1–7 one-to-one, plus the funnel header icon polish mentioned in the spec's page.tsx section is folded into Task 7 Step 5.
- **No placeholders** — every step has complete, runnable code; no "add appropriate styling" or similar.
- **Type consistency** — `Trend` (Task 1) is consumed unchanged by both `StatCard` (Task 4) and `ProductTile` (Task 6); `OverviewHealth` (Task 2) is consumed unchanged by `StatusBanner` (Task 5); `HealthStatus` (existing, unchanged) is consumed by `ProductTile` (Task 6) exactly as `ProductHealthCard` already consumes it, confirming the two independently maintained `HEALTH` maps stay shape-compatible without a shared import (each file owns its own copy, matching the existing per-file convention — no cross-file coupling introduced).
- **Task 6/7 ordering note:** Task 6 intentionally leaves the repo in a briefly broken state (page.tsx still imports the deleted `product-card.tsx`) between Task 6's commit and Task 7's commit. This is called out explicitly in Task 6 Step 2 so an implementer or reviewer doesn't mistake it for an error. `pnpm check` is not run at the full-repo level until Task 7 Step 7.
