# Vendor Dashboard Savings Estimate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an estimated time/money-saved panel to the vendor `/dashboard` — per active kit card, plus a page-level summary — with a Free→Pro upsell delta, using flat per-kit/per-tier assumption numbers (no real per-vendor usage data exists).

**Architecture:** One new pure data module (`src/lib/savings.ts`) computes a `VendorSavings` result from the vendor's existing `VendorLink[]` (already loaded by `requireActiveVendor()` in `page.tsx` — no new data fetch). One new presentational component (`SavingsSummary`) renders the page-level total; `VendorKitCard` gets an optional `savings` prop for the per-card line. `page.tsx` wires the two together.

**Tech Stack:** Next.js 16 App Router (server component page), TypeScript strict, Vitest + `@testing-library/react` (jsdom), Tailwind v4 utility classes matching existing card styling.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- No user input on this feature (all data server-derived) — no Zod boundary needed here.
- Comments explain WHY, not WHAT; no change-narration comments.
- Reuse `money()` from `src/lib/format.ts` for all cent→dollar display — do not hand-roll formatting.
- Match existing file/test-path conventions: components under `src/app/dashboard/(app)/` get their DOM test under `test/app/<basename>.test.tsx`; pure lib modules get a co-located `<name>.test.ts` next to the module (see `src/lib/vendor-feedback.ts` / `src/lib/vendor-feedback.test.ts`).
- `pnpm check` (prettier + eslint + tsc) and `pnpm test` must pass before every commit; `pnpm build` must pass before the final commit.
- Work stays on the current feature branch (`feat/dashboard-savings-estimate`) — never commit to `main`.

---

### Task 1: `computeVendorSavings` pure function

**Files:**

- Create: `src/lib/savings.ts`
- Test: `src/lib/savings.test.ts`

**Interfaces:**

- Consumes: `VendorLink` type from `src/lib/vendor.ts` — `{ product_slug: string; status: GrantStatus; plan: string | null }` (`GrantStatus` from `src/lib/admin.ts` is a string union including `"active"`; only its `"active"` value matters here).
- Produces (for Task 2/3/4 to import):
  - `SAVINGS_ASSUMPTIONS: Record<string, { free: SavingsAssumption; pro: SavingsAssumption }>`
  - `type SavingsAssumption = { hoursPerWeek: number; costCentsPerMonth: number }`
  - `type KitSavings = { slug: string; hoursPerWeek: number; costCentsPerMonth: number; upsideHoursPerWeek: number; upsideCostCentsPerMonth: number }`
  - `type VendorSavings = { perKit: KitSavings[]; totalHoursPerWeek: number; totalCostCentsPerMonth: number; totalUpsideCostCentsPerMonth: number }`
  - `function computeVendorSavings(links: VendorLink[]): VendorSavings`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/savings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeVendorSavings } from "./savings";
import type { VendorLink } from "./vendor";

function link(overrides: Partial<VendorLink>): VendorLink {
  return { product_slug: "qkit", status: "active", plan: "free", ...overrides };
}

describe("computeVendorSavings", () => {
  it("returns all-zero totals and an empty perKit for no links", () => {
    const result = computeVendorSavings([]);
    expect(result).toEqual({
      perKit: [],
      totalHoursPerWeek: 0,
      totalCostCentsPerMonth: 0,
      totalUpsideCostCentsPerMonth: 0,
    });
  });

  it("uses the free-tier assumption for an active free-plan kit, with upside toward pro", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
    ]);
    expect(result.perKit).toEqual([
      {
        slug: "qkit",
        hoursPerWeek: 3,
        costCentsPerMonth: 23000,
        upsideHoursPerWeek: 3,
        upsideCostCentsPerMonth: 24000,
      },
    ]);
    expect(result.totalHoursPerWeek).toBe(3);
    expect(result.totalCostCentsPerMonth).toBe(23000);
    expect(result.totalUpsideCostCentsPerMonth).toBe(24000);
  });

  it("uses the pro-tier assumption with zero upside for an active pro-plan kit", () => {
    const result = computeVendorSavings([
      link({ product_slug: "loopkit", plan: "pro" }),
    ]);
    expect(result.perKit).toEqual([
      {
        slug: "loopkit",
        hoursPerWeek: 4,
        costCentsPerMonth: 30000,
        upsideHoursPerWeek: 0,
        upsideCostCentsPerMonth: 0,
      },
    ]);
    expect(result.totalUpsideCostCentsPerMonth).toBe(0);
  });

  it("treats a null plan on an active link as free tier", () => {
    const result = computeVendorSavings([
      link({ product_slug: "paykit", plan: null }),
    ]);
    expect(result.perKit[0]).toMatchObject({
      hoursPerWeek: 2,
      costCentsPerMonth: 15000,
    });
  });

  it("skips a waitlist (non-active) link entirely", () => {
    const result = computeVendorSavings([
      link({ status: "waitlist" as never }),
    ]);
    expect(result.perKit).toEqual([]);
  });

  it("skips an active link to a slug with no assumption entry, without polluting totals", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
      link({ product_slug: "shopkit", plan: "free" }),
    ]);
    expect(result.perKit.map((k) => k.slug)).toEqual(["qkit"]);
    expect(result.totalCostCentsPerMonth).toBe(23000);
  });

  it("sums per-kit totals across multiple active kits", () => {
    const result = computeVendorSavings([
      link({ product_slug: "qkit", plan: "free" }),
      link({ product_slug: "paykit", plan: "pro" }),
    ]);
    expect(result.totalHoursPerWeek).toBe(3 + 5);
    expect(result.totalCostCentsPerMonth).toBe(23000 + 39000);
    expect(result.totalUpsideCostCentsPerMonth).toBe(24000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- savings.test.ts`
Expected: FAIL — `Cannot find module './savings'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/savings.ts`:

```ts
import type { VendorLink } from "@/lib/vendor";

export type SavingsAssumption = {
  hoursPerWeek: number;
  costCentsPerMonth: number;
};

export type KitSavingsAssumptions = {
  free: SavingsAssumption;
  pro: SavingsAssumption;
};

/**
 * Flat per-kit/per-tier estimates — no real per-vendor usage data exists in
 * the metrics pipeline (it only reports aggregates across all of a kit's
 * vendors). $/hour basis: S$18/hr, rounded from the Singapore hawker-stall
 * staff wage (~S$17.4/hr, Jooble, May 2025) as the closest proxy for the
 * owner/staff time these kits displace. $/mo = hrs/week × 4.33 × $18,
 * rounded to the nearest $10. See
 * docs/superpowers/specs/2026-07-26-merqo-dashboard-savings-estimate-design.md
 * for the full per-kit rationale and citations.
 */
export const SAVINGS_ASSUMPTIONS: Record<string, KitSavingsAssumptions> = {
  qkit: {
    free: { hoursPerWeek: 3, costCentsPerMonth: 23000 },
    pro: { hoursPerWeek: 6, costCentsPerMonth: 47000 },
  },
  loopkit: {
    free: { hoursPerWeek: 2, costCentsPerMonth: 15000 },
    pro: { hoursPerWeek: 4, costCentsPerMonth: 30000 },
  },
  paykit: {
    free: { hoursPerWeek: 2, costCentsPerMonth: 15000 },
    pro: { hoursPerWeek: 5, costCentsPerMonth: 39000 },
  },
};

export type KitSavings = {
  slug: string;
  hoursPerWeek: number;
  costCentsPerMonth: number;
  /** Extra saved if upgraded to Pro. Zero when already on Pro. */
  upsideHoursPerWeek: number;
  upsideCostCentsPerMonth: number;
};

export type VendorSavings = {
  perKit: KitSavings[];
  totalHoursPerWeek: number;
  totalCostCentsPerMonth: number;
  totalUpsideCostCentsPerMonth: number;
};

/** A kit with no SAVINGS_ASSUMPTIONS entry is skipped, not zero-filled, so
 *  the total never silently includes a kit it has no real basis for. */
export function computeVendorSavings(links: VendorLink[]): VendorSavings {
  const perKit: KitSavings[] = [];
  let totalHoursPerWeek = 0;
  let totalCostCentsPerMonth = 0;
  let totalUpsideCostCentsPerMonth = 0;

  for (const link of links) {
    if (link.status !== "active") continue;
    const assumptions = SAVINGS_ASSUMPTIONS[link.product_slug];
    if (!assumptions) continue;

    const isPro = link.plan === "pro";
    const tier = isPro ? assumptions.pro : assumptions.free;
    const upsideHoursPerWeek = isPro
      ? 0
      : assumptions.pro.hoursPerWeek - assumptions.free.hoursPerWeek;
    const upsideCostCentsPerMonth = isPro
      ? 0
      : assumptions.pro.costCentsPerMonth - assumptions.free.costCentsPerMonth;

    perKit.push({
      slug: link.product_slug,
      hoursPerWeek: tier.hoursPerWeek,
      costCentsPerMonth: tier.costCentsPerMonth,
      upsideHoursPerWeek,
      upsideCostCentsPerMonth,
    });

    totalHoursPerWeek += tier.hoursPerWeek;
    totalCostCentsPerMonth += tier.costCentsPerMonth;
    totalUpsideCostCentsPerMonth += upsideCostCentsPerMonth;
  }

  return {
    perKit,
    totalHoursPerWeek,
    totalCostCentsPerMonth,
    totalUpsideCostCentsPerMonth,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- savings.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/savings.ts src/lib/savings.test.ts
git commit -m "feat: add vendor savings-estimate calculation"
```

---

### Task 2: `SavingsSummary` component

**Files:**

- Create: `src/app/dashboard/(app)/savings-summary.tsx`
- Test: `test/app/savings-summary.test.tsx`

**Interfaces:**

- Consumes: `VendorSavings` type and shape from Task 1 (`src/lib/savings.ts`); `money(cents: number): string` from `src/lib/format.ts`.
- Produces: `SavingsSummary({ totals }: { totals: VendorSavings })` — a React server component, default export not used (named export, matching `VendorKitCard`'s convention). Renders `null` when `totals.perKit.length === 0`.

- [ ] **Step 1: Write the failing tests**

Create `test/app/savings-summary.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavingsSummary } from "@/app/dashboard/(app)/savings-summary";
import type { VendorSavings } from "@/lib/savings";

function totals(overrides: Partial<VendorSavings>): VendorSavings {
  return {
    perKit: [],
    totalHoursPerWeek: 0,
    totalCostCentsPerMonth: 0,
    totalUpsideCostCentsPerMonth: 0,
    ...overrides,
  };
}

describe("SavingsSummary", () => {
  it("renders nothing when there is no savings data", () => {
    const { container } = render(<SavingsSummary totals={totals({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the total dollar and hours figures", () => {
    render(
      <SavingsSummary
        totals={totals({
          perKit: [
            {
              slug: "qkit",
              hoursPerWeek: 3,
              costCentsPerMonth: 23000,
              upsideHoursPerWeek: 3,
              upsideCostCentsPerMonth: 24000,
            },
          ],
          totalHoursPerWeek: 3,
          totalCostCentsPerMonth: 23000,
          totalUpsideCostCentsPerMonth: 24000,
        })}
      />,
    );
    expect(screen.getByText("$230")).toBeInTheDocument();
    expect(screen.getByText(/3 hrs\/week/)).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
  });

  it("shows the Pro upgrade line only when there is upside", () => {
    render(
      <SavingsSummary
        totals={totals({
          perKit: [
            {
              slug: "loopkit",
              hoursPerWeek: 4,
              costCentsPerMonth: 30000,
              upsideHoursPerWeek: 0,
              upsideCostCentsPerMonth: 0,
            },
          ],
          totalHoursPerWeek: 4,
          totalCostCentsPerMonth: 30000,
          totalUpsideCostCentsPerMonth: 0,
        })}
      />,
    );
    expect(screen.queryByText(/Upgrade to Pro/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- savings-summary.test.tsx`
Expected: FAIL — `Cannot find module '@/app/dashboard/(app)/savings-summary'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/dashboard/(app)/savings-summary.tsx`:

```tsx
import { money } from "@/lib/format";
import type { VendorSavings } from "@/lib/savings";

/** Page-level total of the per-card savings estimates — see
 *  VendorKitCard for the per-kit line and savings.ts for the numbers. */
export function SavingsSummary({ totals }: { totals: VendorSavings }) {
  if (totals.perKit.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm">
      <p>
        Est.{" "}
        <span className="font-semibold text-foreground">
          {money(totals.totalCostCentsPerMonth)}
        </span>{" "}
        saved this month · ~{totals.totalHoursPerWeek} hrs/week back across your
        kits
      </p>
      {totals.totalUpsideCostCentsPerMonth > 0 && (
        <p className="mt-1 text-muted-foreground">
          Upgrade to Pro to save{" "}
          <span className="font-semibold text-foreground">
            +{money(totals.totalUpsideCostCentsPerMonth)}
          </span>{" "}
          more
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Estimated</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- savings-summary.test.tsx`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/"(app)"/savings-summary.tsx test/app/savings-summary.test.tsx
git commit -m "feat: add SavingsSummary component"
```

---

### Task 3: Per-card savings line on `VendorKitCard`

**Files:**

- Modify: `src/app/dashboard/(app)/vendor-kit-card.tsx`
- Modify: `test/app/vendor-kit-card.test.tsx`

**Interfaces:**

- Consumes: `KitSavings` type from Task 1 (`src/lib/savings.ts`); `money()` from `src/lib/format.ts`.
- Produces: `VendorKitCard` gains an optional `savings?: KitSavings` prop. Existing `{ tile: KitTile }` usage (no `savings` passed) keeps rendering exactly as before — used by Task 4's callers as the contract.

- [ ] **Step 1: Write the failing tests**

Append to `test/app/vendor-kit-card.test.tsx` (add these `it` blocks inside the existing `describe("VendorKitCard", ...)`, after the current hover-lift test):

```tsx
it("renders no savings line when savings is omitted", () => {
  render(
    <VendorKitCard
      tile={{
        slug: "qkit",
        name: "qkit",
        tagline: "Take orders and run your queue.",
        href: "https://qkit-sg.vercel.app",
        plan: "free",
      }}
    />,
  );
  expect(screen.queryByText(/saved this month/)).not.toBeInTheDocument();
});

it("renders the savings line when savings is provided", () => {
  render(
    <VendorKitCard
      tile={{
        slug: "qkit",
        name: "qkit",
        tagline: "Take orders and run your queue.",
        href: "https://qkit-sg.vercel.app",
        plan: "free",
      }}
      savings={{
        slug: "qkit",
        hoursPerWeek: 3,
        costCentsPerMonth: 23000,
        upsideHoursPerWeek: 3,
        upsideCostCentsPerMonth: 24000,
      }}
    />,
  );
  expect(screen.getByText(/saved this month/)).toBeInTheDocument();
  expect(screen.getByText("$230", { exact: false })).toBeInTheDocument();
});

it("shows the Pro upside line on a free-plan card with upside", () => {
  render(
    <VendorKitCard
      tile={{
        slug: "qkit",
        name: "qkit",
        tagline: "Take orders and run your queue.",
        href: "https://qkit-sg.vercel.app",
        plan: "free",
      }}
      savings={{
        slug: "qkit",
        hoursPerWeek: 3,
        costCentsPerMonth: 23000,
        upsideHoursPerWeek: 3,
        upsideCostCentsPerMonth: 24000,
      }}
    />,
  );
  expect(screen.getByText(/Pro saves/)).toBeInTheDocument();
});

it("omits the Pro upside line on a pro-plan card", () => {
  render(
    <VendorKitCard
      tile={{
        slug: "loopkit",
        name: "loopkit",
        tagline: "Stamp cards, points and tiers.",
        href: "https://loopkit-sg.vercel.app",
        plan: "pro",
      }}
      savings={{
        slug: "loopkit",
        hoursPerWeek: 4,
        costCentsPerMonth: 30000,
        upsideHoursPerWeek: 0,
        upsideCostCentsPerMonth: 0,
      }}
    />,
  );
  expect(screen.queryByText(/Pro saves/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- vendor-kit-card.test.tsx`
Expected: FAIL — the 3 new assertions expecting savings text fail (prop doesn't exist / text not rendered); the "omitted" test passes trivially since nothing renders yet.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/app/dashboard/(app)/vendor-kit-card.tsx`:

```tsx
import type { KitTile } from "@/lib/vendor";
import type { KitSavings } from "@/lib/savings";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "./upgrade-button";
import { DowngradeButton } from "./downgrade-button";

export function VendorKitCard({
  tile,
  savings,
}: {
  tile: KitTile;
  savings?: KitSavings;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <div className="flex items-center gap-1.5">
          {tile.plan === "pro" && <Badge variant="gold">Pro</Badge>}
          {tile.plan === "free" && <Badge variant="muted">Free</Badge>}
          <Badge variant="success">Live</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      {savings && (
        <p className="mt-2 text-sm text-foreground">
          Est.{" "}
          <span className="font-semibold">
            {money(savings.costCentsPerMonth)}
          </span>{" "}
          saved this month · ~{savings.hoursPerWeek} hrs/week back
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tile.href && (
          <Button asChild size="sm">
            <a href={`${tile.href}/dashboard`} target="_blank" rel="noreferrer">
              Open {tile.name}
            </a>
          </Button>
        )}
        {tile.plan === "free" && <UpgradeButton slug={tile.slug} />}
        {tile.plan === "pro" && <DowngradeButton slug={tile.slug} />}
      </div>
      {tile.plan === "free" &&
        savings &&
        savings.upsideCostCentsPerMonth > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pro saves{" "}
            <span className="font-medium text-foreground">
              +{money(savings.upsideCostCentsPerMonth)}
            </span>{" "}
            more (+{savings.upsideHoursPerWeek} hrs/week)
          </p>
        )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- vendor-kit-card.test.tsx`
Expected: PASS, all 5 tests (1 existing hover-lift + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/"(app)"/vendor-kit-card.tsx test/app/vendor-kit-card.test.tsx
git commit -m "feat: show per-kit savings estimate on VendorKitCard"
```

---

### Task 4: Wire savings into the dashboard page

**Files:**

- Modify: `src/app/dashboard/(app)/page.tsx`

**Interfaces:**

- Consumes: `computeVendorSavings` + `VendorSavings`/`KitSavings` from Task 1; `SavingsSummary` from Task 2; `VendorKitCard`'s new `savings` prop from Task 3.
- Produces: nothing new for later tasks — this is the final integration point.

- [ ] **Step 1: Modify the page**

In `src/app/dashboard/(app)/page.tsx`, add the two imports after the existing `KITS` import:

```ts
import { computeVendorSavings } from "@/lib/savings";
import { SavingsSummary } from "./savings-summary";
```

Inside `DashboardPage`, right after `const { active, pending } = tilesForLinks(links);`, add:

```ts
const savings = computeVendorSavings(links);
const savingsBySlug = new Map(savings.perKit.map((s) => [s.slug, s]));
```

Change the `<h1>` block and the active-tiles `<section>` from:

```tsx
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard key={t.slug} tile={t} />
        ))}
      </section>
```

to:

```tsx
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <SavingsSummary totals={savings} />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard
            key={t.slug}
            tile={t}
            savings={savingsBySlug.get(t.slug)}
          />
        ))}
      </section>
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all existing tests plus the three new files from Tasks 1–3, no regressions.

- [ ] **Step 3: Run the quality gate and build**

Run: `pnpm check && pnpm build`
Expected: both PASS clean (prettier/eslint/tsc, then a successful production build with `/dashboard` compiling).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/"(app)"/page.tsx
git commit -m "feat: wire savings estimate into the vendor dashboard page"
```

---

## Self-Review Notes

- **Spec coverage:** data model + assumption table (Task 1), `SavingsSummary` + framing/"Estimated" caption (Task 2), per-card line + Pro upside delta (Task 3), page wiring + summary placement (Task 4), non-goals respected (no discovery-card changes, no billing changes, no admin-overview changes — none of the tasks touch those files). Testing section of the spec is covered 1:1 by Tasks 1–3's test files plus Task 4's `pnpm check && pnpm build` step.
- **Placeholder scan:** none — every step has literal code or an exact command.
- **Type consistency:** `KitSavings`/`VendorSavings` defined once in Task 1 and imported verbatim (not redefined) in Tasks 2–4; `SavingsSummary`'s prop name (`totals`) and `VendorKitCard`'s prop name (`savings`) are each used consistently across their own test and consumer.
