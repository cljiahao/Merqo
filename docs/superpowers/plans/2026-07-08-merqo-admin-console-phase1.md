# Merqo Admin Console (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Merqo into a qkit-mirrored dual-audience app and build the `/admin/*` Merqo-team console — relocating today's team pages under `/admin`, adding per-product health, a per-vendor detail page, an onboarding funnel, and an attention inbox.

**Architecture:** One Next.js app, two route namespaces. `/admin/*` (this phase) is gated by `requireMerqoTeam()` via a shared `admin/layout.tsx` that renders the header + section nav; each kit's data arrives only over the HTTP metrics API (`fetchProductMetrics`) through the service-role client — never a cross-schema query. `/dashboard/*` (vendor, Phase 2) is reserved, not built here.

**Tech Stack:** Next 16 (App Router, Turbopack, async `cookies`/`params`), TypeScript strict, Tailwind v4, shadcn/ui (new-york), Zod, Supabase (`@supabase/ssr`), Vitest, Playwright.

**Reference:** qkit at `../qkit` — `src/app/admin/layout.tsx`, `src/app/admin/admin-nav.tsx`, `src/app/admin/activation-funnel.tsx` are the exact patterns to mirror.

**Spec:** `docs/superpowers/specs/2026-07-08-merqo-admin-console-phase1-design.md`

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all external/user input with Zod `safeParse()` at boundaries (the metrics payload already is; keep it so).
- Service-role client (`createServiceClient`) only in server code; `metrics_secret` never reaches a browser.
- Cross-kit data only over the HTTP metrics API — never a cross-schema query. Never touch qkit's `public.*`.
- Next 16: `cookies()`, `params`, `searchParams` are async — `await` them.
- Comments explain WHY not what; no change-narration; no commented-out code; no inline comments except sparingly.
- templateCentral: use **only** `templatecentral:standards` (drift check). Do NOT run `templatecentral:add`/`scaffold`/`migrate` — they install better-auth/Drizzle and break RLS.
- No schema change in this phase. Work on branch `feat/admin-console-phase1`. Commit after every task.
- Verify gate before "done": `pnpm check` (prettier + eslint + tsc) and `pnpm test` green.

---

### Task 1: Add request latency (`durationMs`) to `fetchProductMetrics`

Health classification needs how long each kit's metrics call took. Add `durationMs` to every `MetricsResult` branch.

**Files:**

- Modify: `src/lib/metrics-client.ts`
- Test: `test/lib/metrics-client.test.ts`

**Interfaces:**

- Produces: `MetricsResult` gains `durationMs: number` on both the `{ ok: true }` and `{ ok: false }` variants. `fetchProductMetrics(p, opts?)` signature unchanged.

- [ ] **Step 1: Write the failing test** — append inside the existing `describe("fetchProductMetrics", …)` in `test/lib/metrics-client.test.ts`:

```ts
it("reports a numeric durationMs on success", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(goodPayload), { status: 200 }),
  );
  const r = await fetchProductMetrics(row);
  expect(typeof r.durationMs).toBe("number");
  expect(r.durationMs).toBeGreaterThanOrEqual(0);
});

it("reports durationMs even on failure", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
  const r = await fetchProductMetrics(row);
  expect(typeof r.durationMs).toBe("number");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- metrics-client`
Expected: FAIL — `durationMs` is `undefined` (`typeof` is `"undefined"`).

- [ ] **Step 3: Implement** — rewrite `src/lib/metrics-client.ts` result type + timing:

```ts
import {
  metricsPayloadSchema,
  type MetricsPayload,
} from "@/lib/metrics-schema";
import type { RegistryRow } from "@/lib/products";

type MetricsSource = Pick<
  RegistryRow,
  "slug" | "name" | "metrics_url" | "metrics_secret"
>;

export type MetricsResult =
  | { ok: true; product: string; durationMs: number; data: MetricsPayload }
  | {
      ok: false;
      product: string;
      durationMs: number;
      reason: "auth" | "unreachable" | "bad_shape";
    };

export async function fetchProductMetrics(
  p: MetricsSource,
  opts: { timeoutMs?: number } = {},
): Promise<MetricsResult> {
  const started = performance.now();
  const took = () => Math.round(performance.now() - started);

  if (!p.metrics_url || !p.metrics_secret) {
    return {
      ok: false,
      product: p.slug,
      durationMs: took(),
      reason: "unreachable",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(p.metrics_url, {
      headers: { Authorization: `Bearer ${p.metrics_secret}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 401)
      return { ok: false, product: p.slug, durationMs: took(), reason: "auth" };
    if (!res.ok)
      return {
        ok: false,
        product: p.slug,
        durationMs: took(),
        reason: "unreachable",
      };

    // Past a 200, a body we can't read/validate is a product-side problem
    // (bad_shape), not a network outage (unreachable) — keep them distinct so
    // on-call debugging points at the right layer.
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return {
        ok: false,
        product: p.slug,
        durationMs: took(),
        reason: "bad_shape",
      };
    }
    const parsed = metricsPayloadSchema.safeParse(json);
    if (!parsed.success)
      return {
        ok: false,
        product: p.slug,
        durationMs: took(),
        reason: "bad_shape",
      };
    return {
      ok: true,
      product: p.slug,
      durationMs: took(),
      data: parsed.data,
    };
  } catch {
    return {
      ok: false,
      product: p.slug,
      durationMs: took(),
      reason: "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- metrics-client`
Expected: PASS (all prior cases + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics-client.ts test/lib/metrics-client.test.ts
git commit -m "feat: report durationMs from fetchProductMetrics"
```

---

### Task 2: `classifyHealth` — reporting / lagging / down

Pure classifier turning a `MetricsResult` into a health status for the products view and the overview health chip.

**Files:**

- Create: `src/lib/health.ts`
- Test: `test/lib/health.test.ts`

**Interfaces:**

- Consumes: `MetricsResult` (Task 1, now carries `durationMs`).
- Produces: `type HealthStatus = "reporting" | "lagging" | "down"`; `LAGGING_MS`, `FRESHNESS_MS` consts; `classifyHealth(result: MetricsResult, now: number): HealthStatus`. `now` is injected (epoch ms) so the function stays pure/testable.

- [ ] **Step 1: Write the failing test** — `test/lib/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyHealth, LAGGING_MS, FRESHNESS_MS } from "@/lib/health";
import type { MetricsResult } from "@/lib/metrics-client";

const NOW = 1_700_000_000_000;

const ok = (over: {
  durationMs?: number;
  generated_at?: string;
}): MetricsResult => ({
  ok: true,
  product: "qkit",
  durationMs: over.durationMs ?? 50,
  data: {
    product: "qkit",
    generated_at: over.generated_at ?? new Date(NOW).toISOString(),
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
  },
});

describe("classifyHealth", () => {
  it("down when the result failed, whatever the reason", () => {
    const r: MetricsResult = {
      ok: false,
      product: "x",
      durationMs: 10,
      reason: "unreachable",
    };
    expect(classifyHealth(r, NOW)).toBe("down");
  });

  it("reporting when ok, fast, and fresh", () => {
    expect(classifyHealth(ok({ durationMs: 100 }), NOW)).toBe("reporting");
  });

  it("lagging when the call was slow", () => {
    expect(classifyHealth(ok({ durationMs: LAGGING_MS + 1 }), NOW)).toBe(
      "lagging",
    );
  });

  it("lagging when the payload is stale", () => {
    const stale = new Date(NOW - FRESHNESS_MS - 1).toISOString();
    expect(classifyHealth(ok({ generated_at: stale }), NOW)).toBe("lagging");
  });

  it("lagging when generated_at is unparseable", () => {
    expect(classifyHealth(ok({ generated_at: "not-a-date" }), NOW)).toBe(
      "lagging",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- health`
Expected: FAIL — cannot find module `@/lib/health`.

- [ ] **Step 3: Implement** — `src/lib/health.ts`:

```ts
import type { MetricsResult } from "@/lib/metrics-client";

export type HealthStatus = "reporting" | "lagging" | "down";

/** A metrics call slower than this (ms) is degraded, though still succeeding. */
export const LAGGING_MS = 2000;
/** Data older than this (ms) means the kit stopped reporting recently. */
export const FRESHNESS_MS = 15 * 60_000;

/**
 * Classify a kit's health from its last metrics fetch. `now` is passed in (epoch
 * ms) rather than read from the clock so the function is pure and testable.
 */
export function classifyHealth(
  result: MetricsResult,
  now: number,
): HealthStatus {
  if (!result.ok) return "down";
  if (result.durationMs >= LAGGING_MS) return "lagging";
  const generatedMs = Date.parse(result.data.generated_at);
  if (Number.isNaN(generatedMs)) return "lagging";
  if (now - generatedMs > FRESHNESS_MS) return "lagging";
  return "reporting";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- health`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/health.ts test/lib/health.test.ts
git commit -m "feat: classifyHealth (reporting/lagging/down) for kit metrics"
```

---

### Task 3: `onboardingFunnel` — waitlisted / granted / using

Pure reducer for the overview funnel bars.

**Files:**

- Create: `src/lib/funnel.ts`
- Test: `test/lib/funnel.test.ts`

**Interfaces:**

- Consumes: `GrantStatus` from `@/lib/admin` (`"active" | "waitlist"`).
- Produces: `type OnboardingCounts = { waitlisted: number; granted: number; using: number }`; `onboardingFunnel(links: { status: GrantStatus }[], usingCount: number): OnboardingCounts`. `granted` counts active grants, `waitlisted` counts waitlist grants, `using` is passed in (sum of kits' `active_vendors`).

- [ ] **Step 1: Write the failing test** — `test/lib/funnel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { onboardingFunnel } from "@/lib/funnel";

describe("onboardingFunnel", () => {
  it("is all zeros for no links", () => {
    expect(onboardingFunnel([], 0)).toEqual({
      waitlisted: 0,
      granted: 0,
      using: 0,
    });
  });

  it("counts active as granted and waitlist as waitlisted", () => {
    const links = [
      { status: "active" as const },
      { status: "active" as const },
      { status: "waitlist" as const },
    ];
    expect(onboardingFunnel(links, 5)).toEqual({
      waitlisted: 1,
      granted: 2,
      using: 5,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- funnel`
Expected: FAIL — cannot find module `@/lib/funnel`.

- [ ] **Step 3: Implement** — `src/lib/funnel.ts`:

```ts
import type { GrantStatus } from "@/lib/admin";

export type OnboardingCounts = {
  waitlisted: number;
  granted: number;
  using: number;
};

/**
 * Merqo-level onboarding funnel. `links` are flattened vendor↔kit grants;
 * `usingCount` is the sum of kits' reported active vendors (arrives over the
 * metrics API, so it's passed in rather than derived here).
 */
export function onboardingFunnel(
  links: { status: GrantStatus }[],
  usingCount: number,
): OnboardingCounts {
  let waitlisted = 0;
  let granted = 0;
  for (const l of links) {
    if (l.status === "active") granted += 1;
    else waitlisted += 1;
  }
  return { waitlisted, granted, using: usingCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- funnel`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnel.ts test/lib/funnel.test.ts
git commit -m "feat: onboardingFunnel reducer for the admin overview"
```

---

### Task 4: `findVendorGrant` — one vendor's grants by email

Pure lookup the `/admin/vendors/[email]` detail page uses; the async wrapper reuses the already-tested `listVendorGrants`.

**Files:**

- Modify: `src/lib/admin.ts`
- Test: `test/lib/admin.test.ts`

**Interfaces:**

- Consumes: `VendorGrant` (existing).
- Produces: `findVendorGrant(grants: VendorGrant[], email: string): VendorGrant | null` (case-insensitive match); `getVendorGrant(email: string): Promise<VendorGrant | null>` (async: `listVendorGrants()` + `findVendorGrant`).

- [ ] **Step 1: Write the failing test** — append to `test/lib/admin.test.ts`:

```ts
import { findVendorGrant } from "@/lib/admin";

describe("findVendorGrant", () => {
  const grants = [
    {
      email: "a@x.sg",
      kits: [{ slug: "qkit", name: "qkit", status: "active" as const }],
    },
    { email: "b@x.sg", kits: [] },
  ];
  it("matches case-insensitively", () => {
    expect(findVendorGrant(grants, "A@X.SG")?.email).toBe("a@x.sg");
  });
  it("returns null when absent", () => {
    expect(findVendorGrant(grants, "nope@x.sg")).toBeNull();
  });
});
```

(If `test/lib/admin.test.ts` already imports from `@/lib/admin`, add `findVendorGrant` to the existing import instead of a second import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- admin`
Expected: FAIL — `findVendorGrant` is not exported.

- [ ] **Step 3: Implement** — add to `src/lib/admin.ts` (after `groupVendorGrants`):

```ts
/** Find one vendor's grant entry by email (case-insensitive). Pure — tested. */
export function findVendorGrant(
  grants: VendorGrant[],
  email: string,
): VendorGrant | null {
  const key = email.toLowerCase();
  return grants.find((g) => g.email.toLowerCase() === key) ?? null;
}

/** One vendor's grants by email, or null. Gate callers with requireMerqoTeam(). */
export async function getVendorGrant(
  email: string,
): Promise<VendorGrant | null> {
  const grants = await listVendorGrants();
  return findVendorGrant(grants, email);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- admin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts test/lib/admin.test.ts
git commit -m "feat: findVendorGrant / getVendorGrant lookup by email"
```

---

### Task 5: Admin shell — layout + section nav

The host shell every `/admin/*` page plugs into: gate once, render header + tabs. Mirrors qkit's `admin/layout.tsx` + `admin-nav.tsx`.

**Files:**

- Create: `src/app/admin/admin-nav.tsx`
- Create: `src/app/admin/layout.tsx`

**Interfaces:**

- Produces: `<AdminNav />` (client, active-tab by pathname); `AdminLayout` gates with `requireMerqoTeam()` and renders header + nav + `{children}`. Child pages render their own `<main>` container and may re-call `requireMerqoTeam()` for the `user` object.

- [ ] **Step 1: Create the nav** — `src/app/admin/admin-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/team", label: "Team" },
];

/** Admin section tabs. Overview matches exactly; others match by prefix. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-5 pt-4">
      {TABS.map((t) => {
        const active =
          t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create the layout** — `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route once here; child pages re-derive the user cheaply.
  const { user } = await requireMerqoTeam();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Wordmark className="text-2xl" />
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user.email && (
              <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no type errors). Note: `/admin/page.tsx` doesn't exist yet — that's fine; a route without a page just 404s until Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/admin-nav.tsx src/app/admin/layout.tsx
git commit -m "feat: admin shell layout + section nav"
```

---

### Task 6: Relocate the overview to `/admin` + funnel, health chip, attention inbox

Move the current dashboard overview under `/admin`, drop its self-rendered header (the layout owns it now), and enrich it.

**Files:**

- Move: `src/app/dashboard/page.tsx` → `src/app/admin/page.tsx`
- Move: `src/app/dashboard/product-card.tsx` → `src/app/admin/product-card.tsx`
- Move: `src/app/dashboard/loading.tsx` → `src/app/admin/loading.tsx`
- Create: `src/app/admin/onboarding-funnel.tsx`

**Interfaces:**

- Consumes: `classifyHealth` (Task 2), `onboardingFunnel` (Task 3), `listVendorGrants` (existing), `summarizeOverview` (existing).
- Produces: `<OnboardingFunnelView counts={…} />`.

- [ ] **Step 1: Move the files (preserve git history)**

```bash
git mv src/app/dashboard/page.tsx src/app/admin/page.tsx
git mv src/app/dashboard/product-card.tsx src/app/admin/product-card.tsx
git mv src/app/dashboard/loading.tsx src/app/admin/loading.tsx
rmdir src/app/dashboard
```

- [ ] **Step 2: Create the funnel view** — `src/app/admin/onboarding-funnel.tsx`:

```tsx
import type { OnboardingCounts } from "@/lib/funnel";

const STAGES = [
  { key: "waitlisted", label: "Waitlisted" },
  { key: "granted", label: "Granted" },
  { key: "using", label: "Using" },
] as const;

/** Onboarding funnel with drop-off bars + step-conversion %. */
export function OnboardingFunnelView({ counts }: { counts: OnboardingCounts }) {
  const top = Math.max(counts.waitlisted, counts.granted, counts.using, 1);
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Onboarding
      </h2>
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const n = counts[stage.key];
          const prev = i === 0 ? n : counts[STAGES[i - 1].key];
          const stepPct = prev ? Math.round((n / prev) * 100) : 0;
          return (
            <div key={stage.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="font-mono tabular-nums">
                  {n}
                  {i > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {stepPct}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(n / top) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite the overview** — `src/app/admin/page.tsx`:

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

export const revalidate = 0;

export default async function AdminOverviewPage() {
  await requireMerqoTeam();
  const [products, grants] = await Promise.all([
    listLiveProducts(),
    listVendorGrants(),
  ]);
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );
  const totals = summarizeOverview(results);

  // Reading the wall clock in an async server component is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const health = results.map((r) => classifyHealth(r, now));
  const lagging = health.filter((h) => h === "lagging").length;

  const links = grants.flatMap((g) => g.kits);
  const funnel = onboardingFunnel(links, totals.active_vendors);
  const waitlist = grants
    .flatMap((g) => g.kits.map((k) => ({ email: g.email, kit: k })))
    .filter((x) => x.kit.status === "waitlist");
  const attention = waitlist.length + totals.pending_upgrade_requests;

  const allDown = products.length > 0 && totals.products_reporting === 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.products_reporting} reporting
          {lagging > 0 ? ` · ${lagging} lagging` : ""}
          {totals.products_down > 0 ? ` · ${totals.products_down} down` : ""}
        </p>
      </div>

      {attention > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs attention · {attention}
          </h2>
          {waitlist.map((w) => (
            <div
              key={`${w.email}-${w.kit.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${encodeURIComponent(w.email)}`}
                  className="truncate font-medium hover:underline"
                >
                  {w.email}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  waitlisted for {w.kit.slug}
                </p>
              </div>
            </div>
          ))}
          {totals.pending_upgrade_requests > 0 && (
            <p className="text-sm text-muted-foreground">
              {totals.pending_upgrade_requests} upgrade request
              {totals.pending_upgrade_requests === 1 ? "" : "s"} across kits.
            </p>
          )}
        </section>
      )}

      {allDown ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground"
        >
          Metrics unavailable — no product is reporting right now.
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Revenue (all)"
            value={money(totals.revenue_cents_all)}
            accent
          />
          <StatCard label="GMV (30d)" value={money(totals.gmv_cents_30d)} />
          <StatCard
            label="Active vendors"
            value={String(totals.active_vendors)}
          />
          <StatCard label="Orders (7d)" value={String(totals.orders_7d)} />
        </section>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <OnboardingFunnelView counts={funnel} />
      </div>

      <h2 className="mt-10 font-display text-lg font-bold tracking-tight">
        Products
      </h2>
      {products.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm font-medium">No products registered yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kits appear here once they&apos;re added to the registry.
          </p>
        </div>
      ) : (
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p, i) => (
            <ProductCard key={p.slug} name={p.name} result={results[i]} />
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Verify build + typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (`ProductCard` still imports `MetricsResult`, now with `durationMs` — no change needed there.)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/
git commit -m "feat: /admin overview with onboarding funnel, health, attention inbox"
```

---

### Task 7: Products page + health card

Per-kit performance + live/lagging/down health at `/admin/products`.

**Files:**

- Create: `src/app/admin/products/page.tsx`
- Create: `src/app/admin/products/product-health-card.tsx`

**Interfaces:**

- Consumes: `listLiveProducts`, `fetchProductMetrics`, `classifyHealth` (Task 2), `money`.
- Produces: `<ProductHealthCard name result now />`.

- [ ] **Step 1: Create the health card** — `src/app/admin/products/product-health-card.tsx`:

```tsx
import type { MetricsResult } from "@/lib/metrics-client";
import { classifyHealth, type HealthStatus } from "@/lib/health";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const HEALTH: Record<
  HealthStatus,
  { label: string; variant: "success" | "gold" | "destructive" }
> = {
  reporting: { label: "Reporting", variant: "success" },
  lagging: { label: "Lagging", variant: "gold" },
  down: { label: "Down", variant: "destructive" },
};

export function ProductHealthCard({
  name,
  result,
  now,
}: {
  name: string;
  result: MetricsResult;
  now: number;
}) {
  const status = classifyHealth(result, now);
  const badge = HEALTH[status];
  const lastSeen = result.ok
    ? result.data.generated_at.slice(0, 16).replace("T", " ")
    : "—";

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{name}</h3>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-0 text-sm">
        {(
          [
            ["Latency", `${result.durationMs} ms`],
            ["Last seen", lastSeen],
            [
              "Active vendors",
              result.ok ? String(result.data.active_vendors) : "—",
            ],
            [
              "Revenue (30d)",
              result.ok ? money(result.data.revenue_cents_30d) : "—",
            ],
            ["Orders (7d)", result.ok ? String(result.data.orders_7d) : "—"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between border-b border-border/60 py-2"
          >
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Create the page** — `src/app/admin/products/page.tsx`:

```tsx
import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { ProductHealthCard } from "./product-health-card";

export const revalidate = 0;

export default async function AdminProductsPage() {
  await requireMerqoTeam();
  const products = await listLiveProducts();
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Products
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Per-kit performance and health.
      </p>

      {products.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No live products registered yet.
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p, i) => (
            <ProductHealthCard
              key={p.slug}
              name={p.name}
              result={results[i]}
              now={now}
            />
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/products/
git commit -m "feat: /admin/products per-kit performance + health"
```

---

### Task 8: Relocate vendors + add per-vendor detail

Move the vendors page under `/admin`, wire row links to a new detail page, and fix the action's `revalidatePath`.

**Files:**

- Move: `src/app/vendors/` → `src/app/admin/vendors/` (page.tsx, grant-form.tsx, revoke-button.tsx, actions.ts, loading.tsx)
- Modify: `src/app/admin/vendors/page.tsx` (drop `DashHeader`, link rows to detail)
- Modify: `src/app/admin/vendors/actions.ts` (`revalidatePath("/vendors")` → `/admin/vendors`)
- Create: `src/app/admin/vendors/[email]/page.tsx`

**Interfaces:**

- Consumes: `getVendorGrant` (Task 4), `listProducts`, `GrantForm`, `RevokeButton` (existing).

- [ ] **Step 1: Move the directory**

```bash
git mv src/app/vendors src/app/admin/vendors
```

- [ ] **Step 2: Edit the index page** — in `src/app/admin/vendors/page.tsx`: remove the `DashHeader` import (line 5) and the `<DashHeader email={user.email} />` line, and replace the outer `<>…</>` fragment with the `<main>` directly. Then make each vendor row's email a link to detail. Concretely, replace the whole return with:

```tsx
return (
  <main className="mx-auto max-w-4xl space-y-10 px-5 py-8">
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Vendors
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant kit access and see who owns what.
      </p>
    </div>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold">Grant a kit</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Give a vendor active access — even if they never joined the waitlist.
      </p>
      <GrantForm products={products} />
    </section>

    <section>
      <h2 className="font-display text-lg font-bold">All vendors</h2>
      {grants.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No vendor links yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {grants.map((v) => (
            <li
              key={v.email}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <Link
                href={`/admin/vendors/${encodeURIComponent(v.email)}`}
                className="font-medium hover:underline"
              >
                {v.email}
              </Link>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {v.kits.map((k) => (
                  <span
                    key={k.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pl-2.5 pr-1 text-xs"
                  >
                    <span className="font-mono">{k.slug}</span>
                    <Badge
                      variant={k.status === "active" ? "success" : "muted"}
                      className="border-0 px-1.5 py-0"
                    >
                      {k.status}
                    </Badge>
                    <RevokeButton email={v.email} slug={k.slug} />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  </main>
);
```

Update the imports at the top of the file to: drop `DashHeader`; add `import Link from "next/link";`. The `requireMerqoTeam`, `listVendorGrants`, `listProducts`, `GrantForm`, `RevokeButton`, `Badge` imports stay. `user` is still returned by `requireMerqoTeam()` but no longer used in JSX — change `const { user } = await requireMerqoTeam();` to `await requireMerqoTeam();`.

- [ ] **Step 3: Fix the action revalidate paths** — in `src/app/admin/vendors/actions.ts`, change both `revalidatePath("/vendors")` calls to `revalidatePath("/admin/vendors")`.

- [ ] **Step 4: Create the detail page** — `src/app/admin/vendors/[email]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerqoTeam } from "@/lib/team";
import { getVendorGrant, listProducts } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { GrantForm } from "../grant-form";
import { RevokeButton } from "../revoke-button";

export const revalidate = 0;

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireMerqoTeam();
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);
  const [grant, products] = await Promise.all([
    getVendorGrant(email),
    listProducts(),
  ]);
  if (!grant) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All vendors
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {grant.email}
        </h1>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold">Kits</h2>
        {grant.kits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No kits yet — grant one below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {grant.kits.map((k) => (
              <li
                key={k.slug}
                className="flex items-center justify-between rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{k.slug}</span>
                  <Badge
                    variant={k.status === "active" ? "success" : "muted"}
                    className="border-0 px-1.5 py-0"
                  >
                    {k.status}
                  </Badge>
                </span>
                <RevokeButton email={grant.email} slug={k.slug} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold">Grant a kit</h2>
        <GrantForm products={products} defaultEmail={grant.email} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Support a prefilled email in `GrantForm`** — open `src/app/admin/vendors/grant-form.tsx`. Add an optional `defaultEmail?: string` prop and use it as the email input's `defaultValue`. (Read the file first; make the minimal change: extend the props type and set `defaultValue={defaultEmail}` on the email field. If the form is uncontrolled, this is a one-line addition; if controlled, initialize its email state from `defaultEmail`.)

- [ ] **Step 6: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/vendors/
git commit -m "feat: relocate vendors under /admin + per-vendor detail page"
```

---

### Task 9: Relocate team under `/admin`

**Files:**

- Move: `src/app/team/` → `src/app/admin/team/` (page.tsx, add-team-form.tsx, remove-member.tsx, actions.ts, loading.tsx)
- Modify: `src/app/admin/team/page.tsx` (drop `DashHeader`)
- Modify: `src/app/admin/team/actions.ts` (`revalidatePath("/team")` → `/admin/team`)

- [ ] **Step 1: Move the directory**

```bash
git mv src/app/team src/app/admin/team
```

- [ ] **Step 2: Edit the page** — in `src/app/admin/team/page.tsx`, remove the `DashHeader` import (line 5) and the `<DashHeader email={user.email} />` line, and replace the outer `<>…</>` fragment with the `<main className="mx-auto max-w-4xl space-y-8 px-5 py-8">…</main>` directly (keep all inner sections unchanged). `user` is still used (`user.id`, `(you)` marker), so keep `const { user } = await requireMerqoTeam();`.

- [ ] **Step 3: Fix the action revalidate paths** — in `src/app/admin/team/actions.ts`, change both `revalidatePath("/team")` calls to `revalidatePath("/admin/team")`.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/team/
git commit -m "feat: relocate team under /admin"
```

---

### Task 10: Wire redirects, delete dead code, update e2e, full verify

Point every `/dashboard|/vendors|/team` reference at `/admin`, delete the now-unused `DashHeader`, refresh the route guard and e2e smoke, and run the full gate.

**Files:**

- Modify: `src/lib/supabase/middleware.ts` (route guard)
- Modify: `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/no-access/page.tsx` (post-auth redirects)
- Modify: `src/components/landing/nav.tsx`, `src/components/landing/hero.tsx`, `src/components/landing/cta.tsx`, `src/app/page.tsx` (authed CTA targets)
- Delete: `src/components/dashboard/dash-header.tsx`
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Update the proxy route guard** — in `src/lib/supabase/middleware.ts`, replace `isProtectedPath`:

```ts
// All operator areas require a session. Everything else (landing, /login,
// /no-access) is public. Merqo-team membership is additionally enforced in each
// page via requireMerqoTeam(); the proxy only guarantees a session. Vendor
// /dashboard (Phase 2) will join this list when it ships.
function isProtectedPath(path: string): boolean {
  return path.startsWith("/admin");
}
```

- [ ] **Step 2: Repoint post-auth redirects** — change each hardcoded destination to `/admin`:
  - `src/app/login/page.tsx` lines 95 and 109: `router.push("/dashboard")` → `router.push("/admin")`.
  - `src/app/reset-password/page.tsx` line 36: `router.push("/dashboard")` → `router.push("/admin")`.
  - `src/app/auth/callback/route.ts` line ~16: the `"/dashboard"` fallback → `"/admin"`.
  - `src/app/no-access/page.tsx` line 42: `<Link href="/dashboard">Check again</Link>` → `href="/admin"`.

- [ ] **Step 3: Repoint landing authed CTAs** — in each of `src/components/landing/nav.tsx`, `hero.tsx`, `cta.tsx`, and `src/app/page.tsx`, change `authed ? "/dashboard" : "/login"` → `authed ? "/admin" : "/login"`.

- [ ] **Step 4: Delete the dead header**

```bash
git rm src/components/dashboard/dash-header.tsx
```

Then confirm nothing imports it:

Run: `git grep -n "dash-header\|DashHeader"`
Expected: no matches.

- [ ] **Step 5: Update the e2e smoke** — in `e2e/smoke.spec.ts`, update the authed-area block routes/headings:

```ts
test("admin overview renders", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("admin vendors page renders a grant control", async ({ page }) => {
  await page.goto("/admin/vendors");
  await expect(
    page.getByRole("heading", { name: "Grant a kit" }),
  ).toBeVisible();
});

test("admin products page renders", async ({ page }) => {
  await page.goto("/admin/products");
  await expect(
    page.getByRole("heading", { name: "Products", exact: true }),
  ).toBeVisible();
});

test("admin team page renders the member add form", async ({ page }) => {
  await page.goto("/admin/team");
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
});
```

Leave the `test.skip(process.env.MERQO_E2E_AUTH !== "1", …)` guard and the two public tests unchanged.

- [ ] **Step 6: Full verification**

Run: `pnpm test`
Expected: PASS (all unit tests, including Tasks 1–4).

Run: `pnpm check`
Expected: PASS (prettier + eslint + `tsc --noEmit`). Fix any formatting with `pnpm format`.

- [ ] **Step 7: Standards drift check**

Invoke `templatecentral:standards` over the changed files (naming / validation / full-stack-type drift). Address any real findings; do NOT run other templateCentral commands.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: repoint auth/CTA routes to /admin, drop DashHeader, update e2e"
```

---

## Self-Review

**Spec coverage:**

- Dual-audience `/admin/*` restructure → Tasks 5–10. ✅
- Relocate `/dashboard`,`/vendors`,`/team` under `/admin` → Tasks 6, 8, 9 (+ redirects Task 10). ✅
- `/admin/products` health → Task 7. ✅
- `/admin/vendors/[email]` detail → Task 8. ✅
- Onboarding funnel → Tasks 3 + 6. ✅
- Attention inbox (waitlist + upgrade requests) → Task 6. ✅
- `fetchProductMetrics` + `durationMs` → Task 1. ✅
- `classifyHealth` → Task 2. ✅
- `proxy.ts` guard → Task 10. ✅
- No schema change / no vendor login / no feedback / no suggestion engine → not in any task (correctly deferred). ✅
- Testing (Vitest pure logic + Playwright gate smoke) → Tasks 1–4, 10. ✅
- templateCentral standards-only → Task 10. ✅

**Type consistency:** `MetricsResult.durationMs` (Task 1) is consumed by `classifyHealth` (Task 2) and `ProductHealthCard` (Task 7). `HealthStatus` (Task 2) drives the health map (Task 7) and overview chip (Task 6). `OnboardingCounts` (Task 3) → `OnboardingFunnelView` (Task 6). `VendorGrant`/`GrantStatus` (existing) → `findVendorGrant` (Task 4), `onboardingFunnel` (Task 3), detail page (Task 8). Names consistent across tasks.

**Placeholder scan:** none — every code step carries full content; the two "read the file first" edits (GrantForm prop, page fragment unwrap) name the exact change.

**Open defaults (from spec, intentionally chosen here):** `LAGGING_MS=2000`, `FRESHNESS_MS=15min` (Task 2); `[email]` routing = URL-encoded email (Tasks 6, 8).
