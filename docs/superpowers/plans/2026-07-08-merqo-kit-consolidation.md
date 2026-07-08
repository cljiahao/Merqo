# Merqo Kit Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Merqo repo to the consolidated 6-kit lineup (qkit, loopkit, shopkit, paykit, stockkit, reachkit) — updating the config, reframing the landing kit-stacker from a qkit flagship to six removable peers, and migrating the product registry.

**Architecture:** Two static config files drive everything: `kits.ts` (roadmap/waitlist truth) and `ecosystem.ts` (the landing kit-stacker graph). Update both, update the three kit-stacker components that hard-code the old qkit-anchor, and add an idempotent FK-safe migration that renames/retires product slugs. No access-model change; consumers re-derive from config.

**Tech Stack:** Next 16, TypeScript strict, Tailwind v4, Vitest, Playwright, Supabase (`@supabase/ssr`) with RLS.

**Spec:** `docs/superpowers/specs/2026-07-08-merqo-kit-consolidation-design.md`
**Reference:** existing `src/lib/kits.ts`, `src/lib/ecosystem.ts`, `supabase/migrations/0002_coming_kits.sql`, `test/lib/kits.test.ts`, `test/lib/ecosystem.test.ts`, `test/db/schema.test.ts`.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Comments explain WHY not what; no change-narration.
- No access-model change: `vendor_links`-as-grant, `/admin/vendors`, `/dashboard` gate untouched.
- `href` is set only for `live` kits (no dead outbound links to unlaunched kits). Canonical URLs of non-live kits recorded as a comment.
- Schema change gets a new numbered migration (`0004_...`); migration must be idempotent and FK-safe (`vendor_links.product_slug → products.slug` has no ON UPDATE CASCADE).
- `products.status` CHECK allows only `'live'` | `'coming_soon'`; the finer `live/coming/planned` split lives in `kits.ts`.
- `ecosystem.ts` slugs stay in lockstep with `kits.ts`.
- templateCentral: only `templatecentral:standards`. Branch `feat/kit-consolidation`. Commit per task. Verify: `pnpm check` + `pnpm test` green.

---

### Task 1: Rewrite `kits.ts` to the 6-kit lineup

**Files:**

- Modify: `src/lib/kits.ts`
- Test: `test/lib/kits.test.ts`

**Interfaces:**

- Produces: `KITS` (6 entries), `LIVE_KITS`, `COMING_KITS`, `WAITLISTABLE_SLUGS`, `QKIT_URL`. The `Kit` type is unchanged (`slug, name, tagline, status, href?`).

- [ ] **Step 1: Update the test** — replace `test/lib/kits.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { KITS, LIVE_KITS, COMING_KITS, WAITLISTABLE_SLUGS } from "@/lib/kits";

describe("kit family config", () => {
  it("has the six consolidated kits", () => {
    expect(KITS.map((k) => k.slug)).toEqual([
      "qkit",
      "loopkit",
      "shopkit",
      "paykit",
      "stockkit",
      "reachkit",
    ]);
  });

  it("has qkit as the one live kit with a link", () => {
    expect(LIVE_KITS).toHaveLength(1);
    expect(LIVE_KITS[0].slug).toBe("qkit");
    expect(LIVE_KITS[0].href).toBeTruthy();
  });

  it("sets href only on live kits (no dead links to unlaunched kits)", () => {
    for (const k of KITS) {
      if (k.status !== "live") expect(k.href).toBeUndefined();
    }
  });

  it("dropped slotkit and renamed tapkit away", () => {
    const slugs = KITS.map((k) => k.slug);
    expect(slugs).not.toContain("slotkit");
    expect(slugs).not.toContain("tapkit");
  });

  it("every kit has a plain-language tagline", () => {
    for (const k of KITS) expect(k.tagline.length).toBeGreaterThan(10);
  });

  it("only coming kits are waitlistable (not live or planned)", () => {
    expect(WAITLISTABLE_SLUGS).toEqual(COMING_KITS.map((k) => k.slug));
    expect(WAITLISTABLE_SLUGS).not.toContain("qkit");
    expect(WAITLISTABLE_SLUGS.length).toBeGreaterThan(0);
  });

  it("has unique slugs", () => {
    const slugs = KITS.map((k) => k.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- kits`
Expected: FAIL — `KITS` still has the old 5-kit lineup (`toEqual` mismatch; `slotkit`/`tapkit` still present).

- [ ] **Step 3: Rewrite `src/lib/kits.ts`** — replace the `QKIT_URL` default and the `KITS` array (keep the `Kit` type, `KitStatus`, and the derived exports):

```ts
/**
 * The Merqo kit family — the source of truth for the landing roadmap grid.
 * Static on purpose: no DB read keeps the landing's LCP fast and lets it render
 * even while Supabase is half-provisioned. Waitlist writes still hit the DB;
 * every `coming` kit here must have a matching `merqo.products` row (see
 * migration 0004) for the vendor_links FK.
 */

export type KitStatus = "live" | "coming" | "planned";

export type Kit = {
  slug: string;
  name: string;
  /** One-line, plain-language "what it does" for a non-technical vendor. */
  tagline: string;
  status: KitStatus;
  /** Only set for `live` kits — where the CTA sends the vendor. */
  href?: string;
};

/** Where the live qkit product lives. Set NEXT_PUBLIC_QKIT_URL per environment
 *  to override (e.g. a custom domain). */
export const QKIT_URL =
  process.env.NEXT_PUBLIC_QKIT_URL ?? "https://qkit.vercel.app";

// Canonical per-kit URLs (each kit is a standalone product on its own domain).
// href is only wired for the live kit; the rest launch on:
//   loopkit.vercel.app · shopkit.vercel.app · paykit.vercel.app
//   stockkit.vercel.app · reachkit.vercel.app
export const KITS: Kit[] = [
  {
    slug: "qkit",
    name: "qkit",
    tagline:
      "Take orders and run your queue from a QR code — no app, no hardware.",
    status: "live",
    href: QKIT_URL,
  },
  {
    slug: "loopkit",
    name: "loopkit",
    tagline: "Stamp cards, points and tiers that bring customers back.",
    status: "coming",
  },
  {
    slug: "shopkit",
    name: "shopkit",
    tagline: "A simple storefront for your catalog, checkout and pre-orders.",
    status: "planned",
  },
  {
    slug: "paykit",
    name: "paykit",
    tagline: "Collect PayNow, cards and cash — with receipts and e-invoices.",
    status: "planned",
  },
  {
    slug: "stockkit",
    name: "stockkit",
    tagline: "Track stock in and out, and know what each dish really costs.",
    status: "planned",
  },
  {
    slug: "reachkit",
    name: "reachkit",
    tagline:
      "Reach customers by SMS, email and WhatsApp — and collect reviews.",
    status: "planned",
  },
];

export const LIVE_KITS = KITS.filter((k) => k.status === "live");
export const COMING_KITS = KITS.filter((k) => k.status === "coming");

/** Slugs a vendor can join a waitlist for — the server action validates against this. */
export const WAITLISTABLE_SLUGS = COMING_KITS.map((k) => k.slug);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- kits`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kits.ts test/lib/kits.test.ts
git commit -m "feat: consolidate kits.ts to the six-kit lineup"
```

---

### Task 2: Reframe the landing kit-stacker (six peers, no flagship)

Rewrite the graph data, drop the un-removable-qkit semantics, and update the three components that hard-code it. This is one atomic task because the `HUB_SLUG` → `DEFAULT_STACKED` rename spans the file and its consumers.

**Files:**

- Modify: `src/lib/ecosystem.ts`
- Modify: `src/components/landing/kit-stacker/kit-stacker.tsx`
- Modify: `src/components/landing/kit-stacker/module-list.tsx`
- Test: `test/lib/ecosystem.test.ts`

**Interfaces:**

- Consumes: `KITS` (Task 1).
- Produces: `KIT_NODES` (6), `KIT_EDGES` (5), `DEFAULT_STACKED` (replaces `HUB_SLUG`), `nodeBySlug`, `activeEdges` (unchanged signatures).

- [ ] **Step 1: Rewrite the test** — replace `test/lib/ecosystem.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  KIT_NODES,
  KIT_EDGES,
  DEFAULT_STACKED,
  activeEdges,
  nodeBySlug,
} from "@/lib/ecosystem";

const slugs = new Set(KIT_NODES.map((n) => n.slug));

describe("ecosystem graph config", () => {
  it("has the six kits and no retired slugs", () => {
    expect(slugs).toEqual(
      new Set(["qkit", "loopkit", "shopkit", "paykit", "stockkit", "reachkit"]),
    );
    expect(slugs.has("slotkit")).toBe(false);
    expect(slugs.has("tapkit")).toBe(false);
  });

  it("defaults the stack to qkit (the live kit), but it is not special", () => {
    expect(DEFAULT_STACKED).toBe("qkit");
    expect(nodeBySlug("qkit")?.status).toBe("live");
  });

  it("every edge references real nodes", () => {
    for (const e of KIT_EDGES) {
      expect(slugs.has(e.from)).toBe(true);
      expect(slugs.has(e.to)).toBe(true);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.desc.length).toBeGreaterThan(5);
    }
  });

  it("links every kit except the standalone stockkit when all are stacked", () => {
    const edges = activeEdges(new Set(KIT_NODES.map((n) => n.slug)));
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    for (const n of KIT_NODES) {
      if (n.slug === "stockkit") continue; // stockkit stands alone by design
      expect(linked.has(n.slug)).toBe(true);
    }
    expect(linked.has("stockkit")).toBe(false);
  });

  it("only shows an edge when both endpoints are stacked", () => {
    expect(activeEdges(new Set(["qkit"]))).toHaveLength(0);
    const withLoop = activeEdges(new Set(["qkit", "loopkit"]));
    expect(withLoop).toHaveLength(1);
    expect(withLoop[0]).toMatchObject({ from: "qkit", to: "loopkit" });
  });

  it("has unique node positions", () => {
    const coords = KIT_NODES.map((n) => `${n.x},${n.y}`);
    expect(new Set(coords).size).toBe(coords.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ecosystem`
Expected: FAIL — `DEFAULT_STACKED` is not exported (still `HUB_SLUG`); nodes still include `slotkit`/`tapkit`.

- [ ] **Step 3: Rewrite `src/lib/ecosystem.ts`** — replace `KIT_NODES`, `KIT_EDGES`, and the `HUB_SLUG` export:

```ts
/**
 * Data for the landing "kit stacker" graph — six standalone kits and the optional
 * integrations between them. Positions are fixed (art-directed, not physics) in a
 * stable viewBox; edges render only when BOTH their endpoints are stacked. No kit
 * is a required flagship — the graph shows connections, not dependencies.
 * Display-only; the waitlist source of truth stays in kits.ts. Keep slugs in sync.
 */

export type KitStatus = "live" | "coming" | "planned";

export type KitNode = {
  slug: string;
  /** Short label shown on the node, e.g. "Queue". */
  short: string;
  status: KitStatus;
  x: number;
  y: number;
};

export type KitEdge = {
  from: string;
  to: string;
  /** 1-word chip shown at the edge midpoint. */
  label: string;
  /** Full sentence for the tooltip + the screen-reader summary. */
  desc: string;
};

export const GRAPH_VIEWBOX = { w: 520, h: 440 };

export const KIT_NODES: KitNode[] = [
  { slug: "qkit", short: "Queue", status: "live", x: 260, y: 80 },
  { slug: "shopkit", short: "Store", status: "planned", x: 120, y: 160 },
  { slug: "loopkit", short: "Loyalty", status: "coming", x: 400, y: 160 },
  { slug: "stockkit", short: "Stock", status: "planned", x: 120, y: 320 },
  { slug: "paykit", short: "Payments", status: "planned", x: 260, y: 380 },
  { slug: "reachkit", short: "Reach", status: "planned", x: 400, y: 320 },
];

export const KIT_EDGES: KitEdge[] = [
  {
    from: "qkit",
    to: "loopkit",
    label: "points",
    desc: "Finished orders earn loyalty points.",
  },
  {
    from: "paykit",
    to: "qkit",
    label: "pay",
    desc: "Take payment as the order is placed.",
  },
  {
    from: "shopkit",
    to: "qkit",
    label: "orders",
    desc: "Online orders drop into your queue.",
  },
  {
    from: "paykit",
    to: "shopkit",
    label: "checkout",
    desc: "Powers checkout on your store.",
  },
  {
    from: "qkit",
    to: "reachkit",
    label: "reviews",
    desc: "Ask for a review after a visit.",
  },
];

/** The kit the stacker starts (and resets) with — qkit, the live one. It is a
 *  sensible starting point, NOT a required anchor: it can be unstacked like any
 *  other kit (no flagship). */
export const DEFAULT_STACKED = "qkit";

export function nodeBySlug(slug: string): KitNode | undefined {
  return KIT_NODES.find((n) => n.slug === slug);
}

/** Edges whose both endpoints are currently stacked. */
export function activeEdges(stacked: ReadonlySet<string>): KitEdge[] {
  return KIT_EDGES.filter((e) => stacked.has(e.from) && stacked.has(e.to));
}
```

- [ ] **Step 4: Update `src/components/landing/kit-stacker/kit-stacker.tsx`** — three edits:
  1. Line 4 import: `import { KIT_NODES, DEFAULT_STACKED } from "@/lib/ecosystem";`
  2. Line 18 `JOURNEY_STEPS`: change the `tapkit` step to `paykit`:

```tsx
const JOURNEY_STEPS = [
  { slug: "shopkit", caption: "A customer orders from your store." },
  { slug: "qkit", caption: "The order drops into your queue." },
  { slug: "paykit", caption: "Payment is taken on the spot." },
  { slug: "loopkit", caption: "They earn points — and come back." },
];
```

3. Replace the three `HUB_SLUG` references and drop the un-removable guard:
   - initial state (line 24-26): `useState<Set<string>>(() => new Set([DEFAULT_STACKED]))`
   - `toggle` (line 46-47): **delete** the `if (slug === HUB_SLUG) return;` line so every kit — including qkit — can be toggled.
   - Reset button (line 147): `onClick={() => setStack([DEFAULT_STACKED])}`
4. Reframe the two copy lines (lines 114-117) away from the flagship framing:

```tsx
<p className="mt-4 max-w-xl text-muted-foreground">
  Each kit runs on its own — add the ones you need and see how they connect,
  then play the journey to watch an order move through them.
</p>
```

- [ ] **Step 5: Update `src/components/landing/kit-stacker/module-list.tsx`** — drop the hub concept:
  1. Remove the `import { HUB_SLUG } from "@/lib/ecosystem";` line (line 3).
  2. Remove `const isHub = k.slug === HUB_SLUG;` (line 36).
  3. Button (line 52): remove `disabled={isHub}`.
  4. sr-only text (lines 66-72): drop the `isHub` branch:

```tsx
<span className="sr-only">
  {on ? `Remove ${k.name} from the stack` : `Add ${k.name} to the stack`}
</span>
```

5. LIVE badge (lines 79-86): drive it off status, not hub:

```tsx
{
  k.status === "live" && (
    <Badge variant="gold" className="px-1.5 py-0 text-[10px]">
      LIVE
    </Badge>
  );
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm test -- ecosystem`
Expected: PASS.
Run: `pnpm exec tsc --noEmit`
Expected: EXIT 0 (no dangling `HUB_SLUG` references — `git grep -n HUB_SLUG` should return nothing).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ecosystem.ts src/components/landing/kit-stacker/kit-stacker.tsx src/components/landing/kit-stacker/module-list.tsx test/lib/ecosystem.test.ts
git commit -m "feat: reframe kit-stacker to six removable peers, no flagship"
```

---

### Task 3: Migration `0004` — consolidate the product registry

**Files:**

- Create: `supabase/migrations/0004_kit_consolidation.sql`
- Test: `test/db/consolidation.test.ts`

**Interfaces:**

- Produces: after this migration, `merqo.products` holds the six kits (with `app_url`), `tapkit`/`slotkit` are gone, and any `tapkit` waitlist links are carried onto `paykit`.

- [ ] **Step 1: Write the failing test** — `test/db/consolidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0004_kit_consolidation.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0004_kit_consolidation migration", () => {
  it("adds the new kit rows", () => {
    for (const slug of ["paykit", "stockkit", "reachkit"]) {
      expect(sql).toContain(`'${slug}'`);
    }
  });

  it("sets each kit's app_url", () => {
    expect(sql).toMatch(/app_url/);
    expect(sql).toContain("qkit.vercel.app");
  });

  it("carries tapkit waitlist links onto paykit BEFORE dropping tapkit", () => {
    const carry = sql.indexOf("set product_slug = 'paykit'");
    const delLinks = sql.indexOf(
      "delete from merqo.vendor_links where product_slug = 'tapkit'",
    );
    expect(carry).toBeGreaterThanOrEqual(0);
    expect(delLinks).toBeGreaterThan(carry); // FK-safe ordering
  });

  it("retires tapkit and slotkit from products", () => {
    expect(sql).toMatch(
      /delete from merqo\.products where slug in \('tapkit', 'slotkit'\)/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- consolidation`
Expected: FAIL — cannot read `0004_kit_consolidation.sql`.

- [ ] **Step 3: Create the migration** — `supabase/migrations/0004_kit_consolidation.sql`:

```sql
-- Merqo product consolidation (Jul 2026): retire tapkit + slotkit, add paykit +
-- stockkit + reachkit, and give each kit its own Vercel app_url. loopkit and
-- shopkit are kept as-is. Idempotent + FK-safe: vendor_links.product_slug -> products
-- has no ON UPDATE CASCADE, so any tapkit waitlist links are carried onto paykit
-- before the tapkit product row is removed.

-- 1. Upsert all six registry rows + app_url. coming_soon is the only non-live value
--    the status CHECK allows; the finer live/coming/planned split lives in kits.ts.
--    on conflict updates name/app_url only, so an existing qkit 'live' status is kept.
insert into merqo.products (slug, name, status, app_url) values
  ('qkit',     'Merqo qkit — Orders',     'live',        'https://qkit.vercel.app'),
  ('loopkit',  'Merqo loopkit — Loyalty', 'coming_soon', 'https://loopkit.vercel.app'),
  ('shopkit',  'Merqo shopkit — Store',   'coming_soon', 'https://shopkit.vercel.app'),
  ('paykit',   'Merqo paykit — Payments', 'coming_soon', 'https://paykit.vercel.app'),
  ('stockkit', 'Merqo stockkit — Stock',  'coming_soon', 'https://stockkit.vercel.app'),
  ('reachkit', 'Merqo reachkit — Reach',  'coming_soon', 'https://reachkit.vercel.app')
on conflict (slug) do update
  set name = excluded.name, app_url = excluded.app_url;

-- 2. Carry any tapkit waitlist signups onto paykit (skip if the vendor already has
--    a paykit link to avoid violating the (email, product_slug) unique constraint),
--    then delete the leftover tapkit links so the tapkit row can be removed.
update merqo.vendor_links vl set product_slug = 'paykit'
  where vl.product_slug = 'tapkit'
    and not exists (
      select 1 from merqo.vendor_links v2
      where v2.email = vl.email and v2.product_slug = 'paykit'
    );
delete from merqo.vendor_links where product_slug = 'tapkit';

-- 3. Retire products no longer in the lineup (no-op if they were never seeded).
delete from merqo.products where slug in ('tapkit', 'slotkit');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- consolidation`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_kit_consolidation.sql test/db/consolidation.test.ts
git commit -m "feat: migration 0004 — consolidate product registry to six kits"
```

---

### Task 4: Verify — landing smoke + full gate

**Files:**

- (No source changes; verification + any fallout fixes only.)

- [ ] **Step 1: Full suite + check**

Run: `pnpm test`
Expected: all passing (kits, ecosystem, consolidation suites included).

Run: `pnpm check`
Expected: prettier + eslint + `tsc --noEmit` clean. If prettier flags, run `pnpm format` and re-run.

- [ ] **Step 2: Confirm no dangling references**

Run: `git grep -n "HUB_SLUG\|slotkit\|tapkit" -- src`
Expected: no matches in `src/` (comments in migrations/tests may mention `tapkit`/`slotkit` — those are fine; the check is that no source code still references them).

- [ ] **Step 3: Landing e2e smoke**

Run: `pnpm test:e2e` (requires `pnpm dev` running per the project's Playwright config; if the environment can't run it, note that and rely on the build).
Expected: the public landing test passes — heading renders and the kit-stacker "Stack all" button is present (the reframe kept the stacker mechanic).

Fallback if e2e can't run here: `pnpm build` must succeed (confirms the landing + kit-stacker compile with the new config).

- [ ] **Step 4: Standards drift check**

Invoke `templatecentral:standards` over the changed files; address real findings only.

- [ ] **Step 5: Commit (only if Steps produced fixes)**

```bash
git add -A
git commit -m "chore: verify kit consolidation (lint/format/e2e)"
```

If no fixes were needed, skip the commit — the task is verification.

---

## Self-Review

**Spec coverage:**

- `kits.ts` 6-kit rewrite + `QKIT_URL` + href-live-only → Task 1. ✅
- `ecosystem.ts` 6 nodes/edges + drop forced anchor + consumers → Task 2. ✅
- Migration `0004` (FK-safe carry-then-delete, app_urls, drop tapkit/slotkit) → Task 3. ✅
- Landing renders / no dead links / full gate → Task 4. ✅
- Config-invariant + ecosystem-coherence + migration tests → Tasks 1-3. ✅
- No access-model change; no qkit/kit-scaffold work → absent (correctly). ✅

**Type consistency:** `Kit`/`KitStatus` unchanged (Task 1). `DEFAULT_STACKED` replaces `HUB_SLUG` and every consumer (`kit-stacker.tsx`, `module-list.tsx`, `ecosystem.test.ts`) is updated in the same task (Task 2) — no dangling references (Task 4 Step 2 guards this). `KIT_NODES`/`KIT_EDGES`/`nodeBySlug`/`activeEdges` signatures unchanged, so `graph-canvas.tsx`, `block-tower.tsx`, `stacker-a11y-summary.tsx` (data-only consumers) need no edits.

**Placeholder scan:** none — every code step carries full content; the two "verify with git grep" steps name exact patterns.

**Ordering note:** Task 3's migration deletes `tapkit` links only after carrying them to `paykit` (test asserts the index ordering). Tasks are independent enough to review separately; Task 2 is the only multi-file one and is atomic by necessity (the rename).
