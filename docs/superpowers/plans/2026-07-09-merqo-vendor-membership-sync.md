# Merqo Vendor Membership Sync (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a vendor with zero `vendor_links` rows hits `/dashboard/pending`, Merqo asks every live kit "is this email an active vendor of yours?" and auto-creates the link if any kit says yes — no manual `/admin/vendors` grant required.

**Architecture:** A new `src/lib/vendor-sync.ts` with three layers — `checkVendorStatus` (one kit's HTTP call, never throws, mirrors `fetchProductMetrics`), `upsertsFromChecks` (pure: which check results become `vendor_links` rows), `syncVendorKits` (glue: fan-out to every live kit, upsert, re-read — also never throws, so a DB or network failure degrades to the existing empty state, not a broken page). Wired into `dashboard/pending/page.tsx` only when `links` is empty. This plan assumes qkit's and loopkit's `/api/merqo/vendor-status` endpoints exist (separate repos/plans) — `syncVendorKits` degrades gracefully (empty result) if they don't, so this plan is independently testable via mocks even if run before those land.

**Tech Stack:** Next.js 16 Server Component + service-role Supabase client, Zod, Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Validate all user input with Zod `safeParse()` at every boundary (AGENTS.md) — the vendor-status HTTP response is untrusted input from another service.
- Authorization lives in RLS + the service-role boundary (AGENTS.md) — `syncVendorKits` runs server-side only, writes via the service-role client.
- Cross-kit data goes over the HTTP metrics API, never a direct cross-schema query (AGENTS.md) — `checkVendorStatus` calls each kit's HTTP endpoint, exactly like `fetchProductMetrics`.
- No secrets in `NEXT_PUBLIC_*`.
- After editing the schema, add a new numbered migration (AGENTS.md) — `0005_vendor_link_sync.sql`.
- A sync failure (kit down, timeout, bad shape) must never throw past `syncVendorKits` — worst case is the vendor sees the same empty state they see today (design spec, "Error handling").
- `last_verified_at` is written by sync but never read/expired in Phase A (design spec, "Non-goals") — do not add any TTL/reconciliation logic.

---

### Task 1: Migration `0005_vendor_link_sync.sql`

**Files:**

- Create: `supabase/migrations/0005_vendor_link_sync.sql`
- Test: `test/db/vendor-link-sync.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `merqo.vendor_links.last_verified_at` (nullable `timestamptz`), read/written by Task 3's `syncVendorKits`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/db/vendor-link-sync.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0005_vendor_link_sync.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0005_vendor_link_sync migration", () => {
  it("adds a nullable last_verified_at column to vendor_links", () => {
    expect(sql).toContain("alter table merqo.vendor_links");
    expect(sql).toContain(
      "add column if not exists last_verified_at timestamptz",
    );
    // must not carry a NOT NULL — NULL is the "manually granted, never synced" marker
    expect(sql).not.toMatch(/last_verified_at timestamptz not null/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/db/vendor-link-sync.test.ts`
Expected: FAIL — `ENOENT` (file doesn't exist yet)

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0005_vendor_link_sync.sql
-- Vendor-membership sync (Phase A, empty-state discovery — see
-- docs/superpowers/specs/2026-07-09-merqo-vendor-membership-sync-design.md).
-- NULL = manually granted by a Merqo team member, never touched by sync.
-- Non-NULL = written by syncVendorKits at the moment it verified the vendor
-- against the kit. Phase A never reads this column back (no TTL/reconciliation
-- sweep yet); it exists now so a later Phase B can key off it without another
-- migration.
alter table merqo.vendor_links
  add column if not exists last_verified_at timestamptz;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/vendor-link-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_vendor_link_sync.sql test/db/vendor-link-sync.test.ts
git commit -m "feat: add vendor_links.last_verified_at for the membership sync"
```

---

### Task 2: `checkVendorStatus` — one kit's HTTP check

**Files:**

- Create: `src/lib/vendor-sync.ts`
- Test: `test/lib/vendor-sync.test.ts`

**Interfaces:**

- Consumes: `RegistryRow` type from `@/lib/products` (existing — `{slug, name, app_url, metrics_url, metrics_secret}`).
- Produces: `type VendorStatusCheck = {ok: true; slug: string; active: boolean; plan: string | null} | {ok: false; slug: string}`; `checkVendorStatus(kit, email, opts?): Promise<VendorStatusCheck>` — consumed by Task 3's `syncVendorKits`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/vendor-sync.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { checkVendorStatus } from "@/lib/vendor-sync";

const kit = {
  slug: "qkit",
  app_url: "https://qkit.vercel.app",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("checkVendorStatus", () => {
  it("calls the kit's vendor-status endpoint with the bearer and email", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active: true, plan: "pro" }), {
        status: 200,
      }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: true, slug: "qkit", active: true, plan: "pro" });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit.vercel.app/api/merqo/vendor-status?email=a%40x.com",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s",
    );
  });

  it("returns active:false, plan:null verbatim from a negative match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active: false, plan: null }), {
        status: 200,
      }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: true, slug: "qkit", active: false, plan: null });
  });

  it("ok:false on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the 200 body fails schema validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nonsense: true }), { status: 200 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the 200 body isn't valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await checkVendorStatus(kit, "a@x.com");
    expect(r).toEqual({ ok: false, slug: "qkit" });
  });

  it("ok:false when the kit has no app_url or metrics_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await checkVendorStatus({
      slug: "ghostkit",
      app_url: null,
      metrics_secret: null,
    });
    expect(r).toEqual({ ok: false, slug: "ghostkit" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: FAIL — `Cannot find module '@/lib/vendor-sync'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/vendor-sync.ts
import { z } from "zod";
import type { RegistryRow } from "@/lib/products";

type VendorStatusSource = Pick<
  RegistryRow,
  "slug" | "app_url" | "metrics_secret"
>;

export type VendorStatusCheck =
  | { ok: true; slug: string; active: boolean; plan: string | null }
  | { ok: false; slug: string };

const vendorStatusSchema = z.object({
  active: z.boolean(),
  plan: z.string().nullable(),
});

/** One kit's answer to "is this email an active vendor of yours?" Never
 *  throws — mirrors fetchProductMetrics's never-throw error handling so one
 *  kit being down can't take out the sync for the others. */
export async function checkVendorStatus(
  kit: VendorStatusSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<VendorStatusCheck> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-status", kit.app_url);
    url.searchParams.set("email", email);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${kit.metrics_secret}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, slug: kit.slug };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, slug: kit.slug };
    }
    const parsed = vendorStatusSchema.safeParse(json);
    if (!parsed.success) return { ok: false, slug: kit.slug };
    return {
      ok: true,
      slug: kit.slug,
      active: parsed.data.active,
      plan: parsed.data.plan,
    };
  } catch {
    return { ok: false, slug: kit.slug };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor-sync.ts test/lib/vendor-sync.test.ts
git commit -m "feat: add checkVendorStatus for the vendor membership sync"
```

---

### Task 3: `upsertsFromChecks` + `syncVendorKits`

**Files:**

- Modify: `src/lib/vendor-sync.ts`
- Modify: `test/lib/vendor-sync.test.ts`

**Interfaces:**

- Consumes: `VendorStatusCheck` (Task 2), `listLiveProducts` from `@/lib/products` (existing), `createServiceClient` from `@/lib/supabase/server` (existing), `VendorLink` type from `@/lib/vendor` (existing — `{product_slug: string; status: GrantStatus}`).
- Produces: `upsertsFromChecks(email, checks, nowIso): {email, product_slug, status: "active", last_verified_at}[]` (pure, tested); `syncVendorKits(email): Promise<VendorLink[]>` — consumed by Task 4's pending page.

- [ ] **Step 1: Write the failing test (for the pure function only — `syncVendorKits` is DB-writing glue and follows this repo's existing convention of leaving such glue to manual/integration verification, same as `admin.ts`'s `grantKit`/`listVendorGrants`, which have no unit test)**

```typescript
// append to test/lib/vendor-sync.test.ts
import { upsertsFromChecks } from "@/lib/vendor-sync";

describe("upsertsFromChecks", () => {
  it("keeps only active:true, ok:true checks, lowercases the email", () => {
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
      },
    ]);
  });

  it("returns an empty array when nothing matched", () => {
    const out = upsertsFromChecks(
      "a@x.com",
      [{ ok: false, slug: "qkit" }],
      "2026-07-09T00:00:00.000Z",
    );
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: FAIL — `upsertsFromChecks is not a function`

- [ ] **Step 3: Write the implementation**

```typescript
// append to src/lib/vendor-sync.ts
import { createServiceClient } from "@/lib/supabase/server";
import { listLiveProducts } from "@/lib/products";
import type { VendorLink } from "@/lib/vendor";

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
    }));
}

/**
 * Ask every live kit whether `email` is one of their active vendors, upsert
 * any positive matches into vendor_links, and return the vendor's current
 * links. Never throws — a kit-down, network, or DB failure degrades to
 * returning [] (the caller then shows the same empty state it shows today,
 * not an error page).
 */
export async function syncVendorKits(email: string): Promise<VendorLink[]> {
  try {
    const supabase = await createServiceClient();
    const kits = await listLiveProducts();
    const checks = await Promise.all(
      kits.map((kit) => checkVendorStatus(kit, email)),
    );
    const upserts = upsertsFromChecks(email, checks, new Date().toISOString());

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("vendor_links")
        .upsert(upserts, { onConflict: "email,product_slug" });
      if (error) {
        console.error("vendor sync: upsert failed", error.message);
        return [];
      }
    }

    const { data, error: readError } = await supabase
      .from("vendor_links")
      .select("product_slug, status")
      .eq("email", email.toLowerCase());
    if (readError) {
      console.error("vendor sync: read failed", readError.message);
      return [];
    }
    return (data ?? []) as VendorLink[];
  } catch (err) {
    console.error("vendor sync: unexpected failure", err);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor-sync.test.ts`
Expected: PASS (9 tests total)

- [ ] **Step 5: Run full typecheck (this task wires in `createServiceClient`/`listLiveProducts`/`VendorLink`, so confirm no import drift)**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor-sync.ts test/lib/vendor-sync.test.ts
git commit -m "feat: add syncVendorKits to upsert vendor_links from live kit checks"
```

---

### Task 4: Wire into `/dashboard/pending`

**Files:**

- Modify: `src/app/dashboard/pending/page.tsx`

**Interfaces:**

- Consumes: `syncVendorKits` (Task 3), `loadVendorContext`/`tilesForLinks`/`hasRenderableActiveKit` (existing, `@/lib/vendor`).
- Produces: the page's new behavior — no new exports (page components aren't imported elsewhere).

- [ ] **Step 1: Edit the page**

Current relevant lines (`src/app/dashboard/pending/page.tsx:13-19`):

```typescript
export default async function PendingPage() {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  if (isTeam) redirect("/admin");
  if (links.some((l) => l.status === "active")) redirect("/dashboard");

  const { pending } = tilesForLinks(links);
```

Replace with:

```typescript
export default async function PendingPage() {
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) redirect("/login");
  if (isTeam) redirect("/admin");

  // A vendor with zero links may have signed up directly on a kit — check
  // before showing "no kits yet" (see vendor-sync.ts; best-effort, never
  // throws, so a sync failure just leaves `links` as the empty array it
  // already was).
  const links =
    initialLinks.length === 0 && user.email
      ? await syncVendorKits(user.email)
      : initialLinks;

  if (hasRenderableActiveKit(links)) redirect("/dashboard");

  const { pending } = tilesForLinks(links);
```

Add the two new imports at the top of the file (alongside the existing `@/lib/vendor` import):

```typescript
import {
  loadVendorContext,
  tilesForLinks,
  hasRenderableActiveKit,
} from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";
```

(This replaces the existing single-name `loadVendorContext, tilesForLinks` import line with the three-name version above, plus the new `vendor-sync` import.)

- [ ] **Step 2: Manual verification (Server Components render via a request — no unit test exists for this page today, matching the rest of `src/app/dashboard/pending/`)**

Run: `pnpm dev`

In Supabase, temporarily as a real signed-up qkit vendor with no `merqo.vendor_links` row: sign in to Merqo, land on `/dashboard/pending`. With qkit's `/api/merqo/vendor-status` endpoint deployed and `MERQO_METRICS_SECRET` set in Merqo's env, expect: an automatic redirect to `/dashboard` on that same load, and a new `active` row in `merqo.vendor_links` with a non-null `last_verified_at`.

With no matching vendor on any kit: expect the existing "No kits yet" copy, unchanged.

- [ ] **Step 3: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: full suite green

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/pending/page.tsx
git commit -m "feat: auto-discover vendor kit membership on the pending page"
```

---

## Self-Review Notes

- **Spec coverage:** migration (Task 1), `checkVendorStatus` contract + never-throw behavior (Task 2), upsert decision + `last_verified_at` stamping (Task 3), empty-state-only trigger + redirect-on-match (Task 4) — every "Changes" bullet in the design spec maps to a task. "Non-goals" (no TTL read, no sync-on-every-load, no push, no new secret, no manual re-check UI) are respected: `last_verified_at` is write-only, the sync call is gated on `initialLinks.length === 0`, `checkVendorStatus` only ever calls out via HTTP with the existing `metrics_secret`, and the page's existing "Check again" button (a `/post-login` link) already re-runs this same path on its next load — no new UI added.
- **No placeholders** — every step has complete code.
- **Type consistency** — `VendorStatusCheck` (Task 2) is the sole input type to `upsertsFromChecks` (Task 3); `syncVendorKits` returns `VendorLink[]` (the exact existing type from `@/lib/vendor`), so Task 4's `hasRenderableActiveKit(links)`/`tilesForLinks(links)` calls type-check against both `initialLinks` and the synced result without a cast.
