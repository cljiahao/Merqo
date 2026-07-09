# Self-Serve Kit Toggle + Tier Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vendor sees their tier (free/pro) per active kit on `/dashboard`, refreshed on every login, and can self-serve "add" a live kit they haven't joined by linking out to that kit's own login page — no admin grant, no new endpoints on qkit/loopkit.

**Architecture:** Extend the existing Phase A vendor-sync machinery (`src/lib/vendor-sync.ts`) to persist the `plan` field it already receives but currently discards, move the sync trigger from "only when links are empty" to "every login" (`/post-login`), and add two small pure-function additions to `src/lib/vendor.ts` (`addableKits`, `plan` passthrough on `tilesForLinks`) that the dashboard UI consumes.

**Tech Stack:** Next.js 16 Server Component + Route Handler, Supabase service-role client (sync) / cookie client (dashboard read), Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- No new endpoints on qkit/loopkit — this plan touches only the Merqo repo.
- No cross-domain session handoff — "add a kit" and "upgrade" are plain `<a>` links to `<kit-domain>/login` / `<kit-domain>/dashboard/plan`, never a new privileged call.
- No live per-page-load tier refresh — `plan` is cached on `vendor_links`, written only when `syncVendorKits` runs.
- No auto-revocation — a negative/failed check never removes or downgrades an existing `vendor_links` row; only a positive match ever writes (design spec, "Non-goals").
- `syncVendorKits` must keep its never-throw contract at every new call site.

---

### Task 1: Migration `0006_vendor_link_tier.sql`

**Files:**

- Create: `supabase/migrations/0006_vendor_link_tier.sql`
- Test: `test/db/vendor-link-tier.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `merqo.vendor_links.plan` (nullable `text`), read/written by Task 2's `syncVendorKits` and Task 3's `loadVendorContext`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/db/vendor-link-tier.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0006_vendor_link_tier.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0006_vendor_link_tier migration", () => {
  it("adds a nullable plan column to vendor_links", () => {
    expect(sql).toContain("alter table merqo.vendor_links");
    expect(sql).toContain("add column if not exists plan text");
    // must not carry a NOT NULL — NULL means "never synced with a plan value"
    expect(sql).not.toMatch(/plan text not null/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/db/vendor-link-tier.test.ts`
Expected: FAIL — `ENOENT` (file doesn't exist yet)

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0006_vendor_link_tier.sql
-- Vendor tier display (self-serve kit toggle feature — see
-- docs/superpowers/specs/2026-07-10-merqo-self-serve-kit-toggle-design.md).
-- NULL = never synced with a plan value (e.g. a manually-granted row).
-- Non-NULL = the tier the kit last reported for this vendor, written by
-- syncVendorKits alongside last_verified_at. No CHECK — different kits may
-- introduce different tier vocabularies later.
alter table merqo.vendor_links
  add column if not exists plan text;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/vendor-link-tier.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_vendor_link_tier.sql test/db/vendor-link-tier.test.ts
git commit -m "feat: add vendor_links.plan for tier display"
```

---

### Task 2: Persist `plan` through `vendor-sync.ts`

**Files:**

- Modify: `src/lib/vendor-sync.ts`
- Modify: `test/lib/vendor-sync.test.ts`

**Interfaces:**

- Consumes: `VendorStatusCheck` (existing — already carries `plan: string | null`, unchanged by this task).
- Produces: `upsertsFromChecks` now returns rows shaped `{email, product_slug, status: "active", last_verified_at, plan}` — consumed by Task 3's DB write (no code change needed there, `syncVendorKits` just upserts whatever `upsertsFromChecks` returns). `syncVendorKits`'s DB read now selects `plan` too, so its returned `VendorLink[]` rows carry it once Task 3 adds the field to that type.

- [ ] **Step 1: Write the failing test**

```typescript
// replace the existing "keeps only active:true, ok:true checks..." test in
// test/lib/vendor-sync.test.ts's describe("upsertsFromChecks") block
it("keeps only active:true, ok:true checks, lowercases the email, carries plan", () => {
  const out = upsertsFromChecks(
    "A@X.com",
    [
      { ok: true, slug: "qkit", active: true, plan: "pro" },
      { ok: true, slug: "loopkit", active: false, plan: null },
      { ok: false, slug: "shopkit" },
    ],
    "2026-07-09T00:00:00.000Z",
  );
  expect(out).toEqual([
    {
      email: "a@x.com",
      product_slug: "qkit",
      status: "active",
      last_verified_at: "2026-07-09T00:00:00.000Z",
      plan: "pro",
    },
  ]);
});

it("carries a null plan through when the kit reports one", () => {
  const out = upsertsFromChecks(
    "a@x.com",
    [{ ok: true, slug: "qkit", active: true, plan: null }],
    "2026-07-09T00:00:00.000Z",
  );
  expect(out[0].plan).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: FAIL — the first updated assertion fails because the actual output object has no `plan` key yet (`toEqual` reports a missing property)

- [ ] **Step 3: Update the implementation**

In `src/lib/vendor-sync.ts`, replace the `upsertsFromChecks` function:

```typescript
/** Which check results should become active vendor_links rows. Pure. */
export function upsertsFromChecks(
  email: string,
  checks: VendorStatusCheck[],
  nowIso: string,
): {
  email: string;
  product_slug: string;
  status: "active";
  last_verified_at: string;
  plan: string | null;
}[] {
  return checks
    .filter(
      (c): c is Extract<VendorStatusCheck, { ok: true }> => c.ok && c.active,
    )
    .map((c) => ({
      email: email.toLowerCase(),
      product_slug: c.slug,
      status: "active" as const,
      last_verified_at: nowIso,
      plan: c.plan,
    }));
}
```

In the same file, in `syncVendorKits`, change the read select from `"product_slug, status"` to `"product_slug, status, plan"`:

```typescript
const { data, error: readError } = await supabase
  .from("vendor_links")
  .select("product_slug, status, plan")
  .eq("email", email.toLowerCase());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: PASS (11 tests total — 9 existing plus the updated/new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor-sync.ts test/lib/vendor-sync.test.ts
git commit -m "feat: persist plan through the vendor-sync upsert and read"
```

---

### Task 3: `addableKits` + `plan` passthrough in `vendor.ts`

**Files:**

- Modify: `src/lib/vendor.ts`
- Modify: `test/lib/vendor.test.ts`

**Interfaces:**

- Consumes: `KITS`, `Kit` type from `@/lib/kits` (existing).
- Produces: `VendorLink` type gains `plan: string | null` (required — every row has this column once Task 1's migration runs). `KitTile` type gains `plan?: string | null`. `tilesForLinks` active tiles carry `plan`. New `addableKits(links: {product_slug: string}[], kits: Kit[] = KITS): KitTile[]` — consumed by Task 5's dashboard page.

- [ ] **Step 1: Write the failing tests**

Append to `test/lib/vendor.test.ts`:

```typescript
describe("tilesForLinks plan passthrough", () => {
  it("carries plan through on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });

  it("leaves plan undefined when the link has none", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active" },
    ]);
    expect(active[0].plan).toBeUndefined();
  });
});

describe("addableKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      status: "planned" as const,
    },
  ];

  it("includes a live kit the vendor has no vendor_links row for", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).toEqual(["qkit"]);
    expect(out[0].href).toBe("https://qkit-sg.vercel.app");
  });

  it("excludes a live kit that already has any vendor_links row", () => {
    expect(addableKits([{ product_slug: "qkit" }], kits)).toEqual([]);
  });

  it("never includes a non-live kit regardless of link state", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).not.toContain("loopkit");
    expect(out.map((t) => t.slug)).not.toContain("shopkit");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: FAIL — `addableKits` is not exported; the plan-passthrough tests fail because `tile.plan` is currently never set

- [ ] **Step 3: Update the implementation**

In `src/lib/vendor.ts`, change the import line to also bring in the `Kit` type:

```typescript
import { KITS, type Kit } from "@/lib/kits";
```

Replace the `KitTile` and `VendorLink` type declarations:

```typescript
export type KitTile = {
  slug: string;
  name: string;
  tagline: string;
  href: string | null;
  /** Only meaningful on an active tile — the tier the kit last reported. */
  plan?: string | null;
};

export type VendorLink = {
  product_slug: string;
  status: GrantStatus;
  plan: string | null;
};
```

Replace the `tilesForLinks` function:

```typescript
/** Map a vendor's link rows onto display tiles via the static KITS config.
 *  KITS is the display allow-list — an unknown slug is dropped, not rendered. */
export function tilesForLinks(
  links: {
    product_slug: string;
    status: GrantStatus;
    plan?: string | null;
  }[],
): { active: KitTile[]; pending: KitTile[] } {
  const bySlug = new Map(KITS.map((k) => [k.slug, k]));
  const active: KitTile[] = [];
  const pending: KitTile[] = [];
  for (const l of links) {
    const kit = bySlug.get(l.product_slug);
    if (!kit) continue;
    const tile: KitTile = {
      slug: kit.slug,
      name: kit.name,
      tagline: kit.tagline,
      href: kit.href ?? null,
      plan: l.status === "active" ? l.plan : undefined,
    };
    (l.status === "active" ? active : pending).push(tile);
  }
  return { active, pending };
}

/** Live kits the vendor has no vendor_links row for at all (not active, not
 *  waitlist) — the "you haven't joined this yet" set for the self-serve
 *  add-a-kit section. Pure — tested. */
export function addableKits(
  links: { product_slug: string }[],
  kits: Kit[] = KITS,
): KitTile[] {
  const linked = new Set(links.map((l) => l.product_slug));
  return kits
    .filter((k) => k.status === "live" && !linked.has(k.slug))
    .map((k) => ({
      slug: k.slug,
      name: k.name,
      tagline: k.tagline,
      href: k.href ?? null,
    }));
}
```

In the same file, in `loadVendorContext`, change the vendor_links select from
`"product_slug, status"` to `"product_slug, status, plan"`:

```typescript
    supabase.from("vendor_links").select("product_slug, status, plan"),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: PASS (14 tests total — 8 existing plus the 6 new ones)

- [ ] **Step 5: Run full typecheck** (this task changes `VendorLink` and `KitTile`, both consumed elsewhere — confirm no drift)

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts
git commit -m "feat: add addableKits and plan passthrough to vendor.ts"
```

---

### Task 4: Sync on every login, not just the empty-links case

**Files:**

- Modify: `src/app/post-login/route.ts`

**Interfaces:**

- Consumes: `syncVendorKits` from `@/lib/vendor-sync` (existing, unchanged signature: `(email: string) => Promise<VendorLink[]>`); `loadVendorContext`, `hasRenderableActiveKit`, `resolveHome` from `@/lib/vendor` (existing).
- Produces: no new exports — this is a route handler, not imported elsewhere.

- [ ] **Step 1: Replace the route**

Current content of `src/app/post-login/route.ts`:

```typescript
import { NextResponse } from "next/server";
import {
  hasRenderableActiveKit,
  loadVendorContext,
  resolveHome,
} from "@/lib/vendor";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const dest = resolveHome({
    isTeam,
    hasActiveKit: hasRenderableActiveKit(links),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
```

Replace with:

```typescript
import { NextResponse } from "next/server";
import {
  hasRenderableActiveKit,
  loadVendorContext,
  resolveHome,
} from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place. Also the once-per-login sync point: refreshes
// membership (new kits the vendor joined directly) and tier (see vendor-sync.ts)
// before deciding where to send them. Never throws, so a bad kit/network/DB
// hiccup here just falls back to the vendor's already-known links.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const links =
    !isTeam && user.email ? await syncVendorKits(user.email) : initialLinks;
  const dest = resolveHome({
    isTeam,
    hasActiveKit: hasRenderableActiveKit(links),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
```

- [ ] **Step 2: Manual verification (no existing test for this route — matches its pre-existing untested state)**

Run: `pnpm dev`, sign in as a vendor whose email is active on qkit (already covered by Phase A), confirm you land on `/dashboard` and the vendor's `merqo.vendor_links` row for `qkit` has an updated `last_verified_at` and a non-null `plan` after this sign-in (previously `last_verified_at` only updated on the first-ever empty-links sync; it should now update on every login).

- [ ] **Step 3: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: full suite green

- [ ] **Step 4: Commit**

```bash
git add src/app/post-login/route.ts
git commit -m "feat: sync vendor kit membership and tier on every login"
```

---

### Task 5: Dashboard UI — tier badge, upgrade link, add-a-kit section

**Files:**

- Modify: `src/app/dashboard/(app)/page.tsx`
- Modify: `src/app/dashboard/(app)/vendor-kit-card.tsx`

**Interfaces:**

- Consumes: `addableKits`, `tilesForLinks` (Task 3, `@/lib/vendor`), `KitTile.plan` (Task 3).
- Produces: no new exports — these are page/component files, not imported elsewhere.

- [ ] **Step 1: Update the dashboard page**

Current content of `src/app/dashboard/(app)/page.tsx`:

```typescript
import Link from "next/link";
import { requireActiveVendor, tilesForLinks } from "@/lib/vendor";
import { VendorKitCard } from "./vendor-kit-card";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard key={t.slug} tile={t} />
        ))}
      </section>

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Requested
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((t) => (
              <li
                key={t.slug}
                className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">
                  — we&apos;ll email you when it opens.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        More kits coming —{" "}
        <Link href="/" className="font-medium text-foreground hover:underline">
          see the family
        </Link>
        .
      </p>
    </>
  );
}
```

Replace with:

```typescript
import Link from "next/link";
import { requireActiveVendor, tilesForLinks, addableKits } from "@/lib/vendor";
import { VendorKitCard } from "./vendor-kit-card";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);
  const addable = addableKits(links);

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard key={t.slug} tile={t} />
        ))}
      </section>

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Requested
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((t) => (
              <li
                key={t.slug}
                className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">
                  — we&apos;ll email you when it opens.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {addable.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a kit
          </h2>
          <ul className="mt-3 space-y-2">
            {addable.map((t) => (
              <li
                key={t.slug}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {t.tagline}
                  </span>
                </div>
                {t.href && (
                  <a
                    href={`${t.href}/login`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-medium text-foreground hover:underline"
                  >
                    Add {t.name}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        More kits coming —{" "}
        <Link href="/" className="font-medium text-foreground hover:underline">
          see the family
        </Link>
        .
      </p>
    </>
  );
}
```

- [ ] **Step 2: Update the kit card**

Current content of `src/app/dashboard/(app)/vendor-kit-card.tsx`:

```typescript
import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function VendorKitCard({ tile }: { tile: KitTile }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <Badge variant="success">Live</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      {tile.href && (
        <Button asChild size="sm" className="mt-4">
          <a href={tile.href} target="_blank" rel="noreferrer">
            Open {tile.name}
          </a>
        </Button>
      )}
    </div>
  );
}
```

Replace with:

```typescript
import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function VendorKitCard({ tile }: { tile: KitTile }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <div className="flex items-center gap-1.5">
          {tile.plan === "pro" && <Badge variant="gold">Pro</Badge>}
          {tile.plan === "free" && <Badge variant="muted">Free</Badge>}
          <Badge variant="success">Live</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tile.href && (
          <Button asChild size="sm">
            <a href={tile.href} target="_blank" rel="noreferrer">
              Open {tile.name}
            </a>
          </Button>
        )}
        {tile.plan === "free" && tile.href && (
          <a
            href={`${tile.href}/dashboard/plan`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-foreground hover:underline"
          >
            Upgrade to Pro
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual browser verification (no existing test for either file — matches their pre-existing untested state; AGENTS.md requires exercising UI changes in a real browser before claiming done)**

Run: `pnpm dev`, sign in as a vendor with an active `qkit` link:

- If that vendor's `vendor_links` row has `plan = 'pro'`, confirm a gold "Pro" badge shows next to "Live" on the qkit tile, and no "Upgrade to Pro" link appears.
- If `plan = 'free'`, confirm a "Free" badge shows and an "Upgrade to Pro" link appears, pointing to `<qkit-domain>/dashboard/plan`.
- If `plan` is `null` (e.g. a manually-granted row that's never been synced), confirm neither badge shows and the card looks exactly as it did before this task.
- Since only `qkit` is `status: "live"` in `src/lib/kits.ts` today, the "Add a kit" section will be empty for any vendor already linked to qkit — confirm it simply doesn't render (no empty section, no broken layout) rather than trying to force a non-empty case; this section becomes exercisable once a second kit (e.g. loopkit) flips to `live`.

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: full suite green (this task adds no new test files, so the count is unchanged from Task 3's final total)

- [ ] **Step 5: Commit**

```bash
git add "src/app/dashboard/(app)/page.tsx" "src/app/dashboard/(app)/vendor-kit-card.tsx"
git commit -m "feat: show tier badge, upgrade link, and add-a-kit section on the dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** migration (Task 1), `plan` persisted through sync writes+reads (Task 2), `addableKits` + tile `plan` passthrough + `loadVendorContext`'s select updated (Task 3), sync-on-every-login (Task 4), dashboard tier badge + upgrade link + add-a-kit section (Task 5) — every "Changes" bullet in the design spec maps to a task. All five "Non-goals" are respected: no kit-side endpoints added, "add a kit"/"upgrade" are plain links (no session handoff), tier is cached not live-fetched, no revocation logic anywhere, no new manual-refresh UI (the existing "Check again" button already re-hits `/post-login`, now the sync trigger).
- **No placeholders** — every step has complete, runnable code.
- **Type consistency** — `VendorLink.plan` (Task 3) matches what Task 2's `syncVendorKits` select now reads (`product_slug, status, plan`); `KitTile.plan` (Task 3) is exactly what Task 5's `VendorKitCard` reads (`tile.plan === "pro" | "free"`); `addableKits`'s return shape is the same `KitTile` type `VendorKitCard` and the "Add a kit" list item both already know how to render (`slug`, `name`, `tagline`, `href`).
