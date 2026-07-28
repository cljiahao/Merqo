# Vendor Push Provisioning + One-Click Kit Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in Merqo hub vendor activate qkit and/or loopkit with one click each (or both at once), without leaving the hub or visiting that kit's own signup page.

**Architecture:** Each kit (qkit, loopkit) gets a new `POST /api/merqo/vendor-provision` route, guarded by a new `MERQO_PROVISION_SECRET` (distinct from the existing read-only `MERQO_METRICS_SECRET`), that idempotently creates a free-tier tenant row for a given `user_id`. Merqo hub fans out to these routes in parallel (`Promise.allSettled`, one retry, 3s timeout) from a new server action, wired to a primary "Activate all my kits" button plus upgraded per-kit "Add" buttons.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (`@supabase/ssr` + service-role client), Zod, Vitest, pgTAP (`supabase test db`).

> **Deployment status: NOT yet functional in any environment.** This feature
> requires manual operator setup before it works at all: (1) generate a real
> `MERQO_PROVISION_SECRET` value, (2) set it as an env var in qkit, loopkit,
> and merqo's deployments, (3) run
> `update merqo.products set provision_secret = '<value>' where slug in ('qkit', 'loopkit')`
> via the Supabase SQL editor, (4) add `MERQO_PROVISION_SECRET=` to qkit's
> `.env.example` (blocked from automated edit in the implementation session —
> one-line manual addition needed). Until all four are done, every activation
> attempt will fail with a retry prompt — this is expected, not a bug. Separately,
> loopkit's `0032` migration (see loopkit's own progress ledger) was edited in
> place twice during development rather than appended to — any environment
> that already applied an earlier version of it needs a fresh
> `supabase db reset` (or a manual `create or replace function` re-run), not a
> normal `db push`, since Supabase's migration tracking won't detect the file changed.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (all three repos' AGENTS.md).
- All user input validated with Zod at the boundary — here, the `vendor-provision` route's request body.
- The service-role client is server-only, never in a client component.
- `MERQO_PROVISION_SECRET` must be a DIFFERENT value from `MERQO_METRICS_SECRET` in every repo's env — never reuse the metrics secret for this route (write capability, higher blast radius than a read-only check).
- Never hardcode a kit count ("2" or "3") in copy or logic — both the bulk button and its target list are driven by whichever kits actually support `vendor-provision`.
- Follow each repo's existing `bearerOk()` / constant-time-compare pattern exactly (`timingSafeEqual`, length-gated first) — do not invent a new auth mechanism.
- Spec: `docs/superpowers/specs/2026-07-28-vendor-push-provisioning-design.md` (this plan implements it in full; re-read it if any task here seems to contradict it — the spec wins).

---

### Task 1: Merqo — prerequisite migration (fix loopkit's live status, add `provision_secret`)

**Files:**

- Create: `supabase/migrations/0013_fix_loopkit_live_status_and_provision_secret.sql`
- Modify: `src/lib/products.ts`
- Modify: `test/lib/vendor-sync.test.ts` (add one assertion)

**Interfaces:**

- Produces: `RegistryRow.provision_secret: string | null`; `listLiveProducts()` now selects it and includes loopkit (status corrected to `'live'`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0013_fix_loopkit_live_status_and_provision_secret.sql

-- Bugfix found while scoping vendor push-provisioning (2026-07-28 design):
-- loopkit was seeded as 'coming_soon' in 0004_kit_consolidation.sql despite
-- src/lib/kits.ts already showing it as fully live — listLiveProducts()
-- filters on THIS column, so the existing pull-sync has silently excluded
-- loopkit from vendor auto-discovery since 0004. Fixing here also closes
-- that pre-existing gap as a side effect.
update merqo.products set status = 'live' where slug = 'loopkit';

-- New column for the vendor-provision write endpoint's bearer secret —
-- deliberately a SEPARATE secret from metrics_secret (read-only), added as
-- a nullable column here; the actual secret VALUE is set out-of-band via
-- the Supabase dashboard/SQL editor (same pattern metrics_secret already
-- uses — never commit a real secret value in a migration file).
alter table merqo.products
  add column if not exists provision_secret text; -- server-only; never read by anon/client
```

- [ ] **Step 2: Apply the migration locally and verify**

Run: `supabase db reset` (or `supabase migration up` if already running), then:

```sql
select slug, status, provision_secret from merqo.products where slug in ('loopkit', 'qkit');
```

Expected: `loopkit` row shows `status = 'live'`; both rows have a `provision_secret` column (value `null` until set out-of-band).

- [ ] **Step 3: Update `RegistryRow` and `listLiveProducts()`**

In `src/lib/products.ts`, change:

```ts
export type RegistryRow = {
  slug: string;
  name: string;
  app_url: string | null;
  metrics_url: string | null;
  metrics_secret: string | null;
};

export async function listLiveProducts(): Promise<RegistryRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name, app_url, metrics_url, metrics_secret")
    .eq("status", "live");
  if (error) throw new Error(`products read failed: ${error.message}`);
  return (data ?? []) as RegistryRow[];
}
```

to:

```ts
export type RegistryRow = {
  slug: string;
  name: string;
  app_url: string | null;
  metrics_url: string | null;
  metrics_secret: string | null;
  provision_secret: string | null;
};

export async function listLiveProducts(): Promise<RegistryRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, name, app_url, metrics_url, metrics_secret, provision_secret",
    )
    .eq("status", "live");
  if (error) throw new Error(`products read failed: ${error.message}`);
  return (data ?? []) as RegistryRow[];
}
```

- [ ] **Step 4: Write the failing test (loopkit now included)**

Add `listLiveProducts` to this file's existing top-of-file import block (currently `import { checkVendorStatus, upsertsFromChecks } from "@/lib/vendor-sync";`) as a separate import line:

```ts
import { listLiveProducts } from "@/lib/products";
```

Then add this new `describe` block at the end of the file:

```ts
describe("listLiveProducts (post-0013 migration)", () => {
  it("includes loopkit now that its status is corrected to live", async () => {
    const products = await listLiveProducts();
    const slugs = products.map((p) => p.slug);
    expect(slugs).toContain("loopkit");
    expect(slugs).toContain("qkit");
  });

  it("every row carries a provision_secret field (nullable)", async () => {
    const products = await listLiveProducts();
    for (const p of products) {
      expect(p).toHaveProperty("provision_secret");
    }
  });
});
```

This test hits a real local Supabase instance (matching this file's existing convention — `checkVendorStatus`/`upsertsFromChecks` above it are pure-function tests, but `listLiveProducts` itself is a thin DB read with no mock seam here) — requires `supabase start` + the migration applied locally first (Step 2).

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run: `pnpm test vendor-sync.test.ts`
Before Step 2/3: fails (`provision_secret` column doesn't exist / loopkit not in results).
After Step 2/3: passes.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0013_fix_loopkit_live_status_and_provision_secret.sql src/lib/products.ts test/lib/vendor-sync.test.ts
git commit -m "fix: correct loopkit's live status, add provision_secret column"
```

---

### Task 2: qkit — `provisionBearerOk` auth helper

**Files:**

- Modify: `src/lib/merqo-auth.ts`
- Create: `test/lib/merqo-auth.test.ts`

**Interfaces:**

- Produces: `provisionBearerOk(request: Request): boolean` — same shape as the existing `bearerOk`, checked against `MERQO_PROVISION_SECRET` instead of `MERQO_METRICS_SECRET`.

- [ ] **Step 1: Write the failing test**

```ts
// test/lib/merqo-auth.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { provisionBearerOk } from "@/lib/merqo-auth";

function req(auth?: string) {
  return new Request("http://localhost/api/merqo/vendor-provision", {
    headers: auth ? { Authorization: auth } : {},
  });
}

describe("provisionBearerOk", () => {
  beforeEach(() => {
    process.env.MERQO_PROVISION_SECRET = "provision-secret";
    process.env.MERQO_METRICS_SECRET = "metrics-secret";
  });

  it("true on the correct provision secret", () => {
    expect(provisionBearerOk(req("Bearer provision-secret"))).toBe(true);
  });

  it("false when the bearer is missing", () => {
    expect(provisionBearerOk(req())).toBe(false);
  });

  it("false when the METRICS secret is sent instead — the two must not be interchangeable", () => {
    expect(provisionBearerOk(req("Bearer metrics-secret"))).toBe(false);
  });

  it("false when MERQO_PROVISION_SECRET is unset", () => {
    delete process.env.MERQO_PROVISION_SECRET;
    expect(provisionBearerOk(req("Bearer provision-secret"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test merqo-auth.test.ts`
Expected: FAIL — `provisionBearerOk` is not exported yet.

- [ ] **Step 3: Add `provisionBearerOk` to `src/lib/merqo-auth.ts`**

Append (do not modify the existing `bearerOk`):

```ts
/** Constant-time bearer check against MERQO_PROVISION_SECRET — deliberately
 *  a DIFFERENT env var from bearerOk's MERQO_METRICS_SECRET. This guards a
 *  write endpoint (creates a real tenant row); a leak of the routine
 *  metrics-polling secret must not also grant that capability. */
export function provisionBearerOk(request: Request): boolean {
  const secret = process.env.MERQO_PROVISION_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
```

(`timingSafeEqual` is already imported at the top of this file for `bearerOk`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test merqo-auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merqo-auth.ts test/lib/merqo-auth.test.ts
git commit -m "feat: add provisionBearerOk, distinct secret from metrics bearer check"
```

---

### Task 3: qkit — `vendor-provision` route

**Files:**

- Create: `src/app/api/merqo/vendor-provision/route.ts`
- Create: `src/app/api/merqo/vendor-provision/README.md`
- Create: `test/api/merqo/vendor-provision.test.ts`

**Interfaces:**

- Consumes: `provisionBearerOk` (Task 2), `getOrCreateVendorProfile` (existing, `@/lib/merqo-vendor-profile`), `createServiceClient` (existing, `@/lib/supabase/server`).
- Produces: `POST /api/merqo/vendor-provision` — body `{ user_id: string }`, response `{ ok: true, already_existed: boolean, plan: "free" | "pro" }` / `401` (bad bearer) / `400` (bad body or unknown `user_id`) / `500` (unexpected failure).

- [ ] **Step 1: Write the failing test**

```ts
// test/api/merqo/vendor-provision.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock })),
}));

const { getOrCreateVendorProfileMock } = vi.hoisted(() => ({
  getOrCreateVendorProfileMock: vi.fn(),
}));
vi.mock("@/lib/merqo-vendor-profile", () => ({
  getOrCreateVendorProfile: getOrCreateVendorProfileMock,
}));

import { POST } from "@/app/api/merqo/vendor-provision/route";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function req(body: unknown, auth?: string) {
  return new Request("http://localhost/api/merqo/vendor-provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Chainable insert/select stub: insert() and select().eq().maybeSingle()
// both resolve from the same mock, configured per-test.
function vendorsTable(opts: {
  insertError?: { code: string; message: string } | null;
  planRow?: { plan: string } | null;
  readError?: { message: string } | null;
}) {
  return {
    insert: () => Promise.resolve({ error: opts.insertError ?? null }),
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: opts.planRow ?? null,
            error: opts.readError ?? null,
          }),
      }),
    }),
  };
}

describe("POST /api/merqo/vendor-provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = "test-secret";
    getOrCreateVendorProfileMock.mockResolvedValue({});
  });

  it("401 when the bearer is missing", async () => {
    const res = await POST(req({ user_id: USER_ID }));
    expect(res.status).toBe(401);
  });

  it("400 when user_id is not a UUID", async () => {
    const res = await POST(
      req({ user_id: "not-a-uuid" }, "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
  });

  it("creates a new vendor row, seeds the profile, returns plan free", async () => {
    fromMock.mockReturnValue(
      vendorsTable({ insertError: null, planRow: { plan: "free" } }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: false,
      plan: "free",
    });
    expect(getOrCreateVendorProfileMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      null,
    );
  });

  it("second call (already exists) is a no-op — does not re-seed the profile", async () => {
    fromMock.mockReturnValue(
      vendorsTable({
        insertError: { code: "23505", message: "duplicate key" },
        planRow: { plan: "free" },
      }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: true,
      plan: "free",
    });
    expect(getOrCreateVendorProfileMock).not.toHaveBeenCalled();
  });

  it("re-provisioning an already-Pro vendor reports plan pro, not free", async () => {
    fromMock.mockReturnValue(
      vendorsTable({
        insertError: { code: "23505", message: "duplicate key" },
        planRow: { plan: "pro" },
      }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: true,
      plan: "pro",
    });
  });

  it("400 on a foreign-key violation (unknown user_id)", async () => {
    fromMock.mockReturnValue(
      vendorsTable({
        insertError: { code: "23503", message: "fk violation" },
      }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(400);
  });

  it("500 when the profile seed throws", async () => {
    fromMock.mockReturnValue(
      vendorsTable({ insertError: null, planRow: { plan: "free" } }),
    );
    getOrCreateVendorProfileMock.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test vendor-provision.test.ts`
Expected: FAIL — route file doesn't exist.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/merqo/vendor-provision/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { provisionBearerOk } from "@/lib/merqo-auth";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";

export const revalidate = 0;

const bodySchema = z.object({ user_id: z.string().uuid() });

export async function POST(request: Request) {
  if (!provisionBearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const { user_id } = parsed.data;

  const supabase = await createServiceClient();

  const { error: insertError } = await supabase
    .from("vendors")
    .insert({ id: user_id });
  const alreadyExisted = insertError?.code === "23505";
  if (insertError && !alreadyExisted) {
    if (insertError.code === "23503") {
      return NextResponse.json({ error: "Unknown user_id" }, { status: 400 });
    }
    console.error("vendor-provision: insert failed", insertError.message);
    return NextResponse.json(
      { error: "Could not provision vendor" },
      { status: 500 },
    );
  }

  if (!alreadyExisted) {
    try {
      await getOrCreateVendorProfile(supabase, user_id, null);
    } catch (err) {
      console.error(
        "vendor-provision: profile seed failed",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: "Could not provision vendor" },
        { status: 500 },
      );
    }
  }

  const { data: vendorRow, error: readError } = await supabase
    .from("vendors")
    .select("plan")
    .eq("id", user_id)
    .maybeSingle();
  if (readError || !vendorRow) {
    console.error("vendor-provision: read-back failed", readError?.message);
    return NextResponse.json(
      { error: "Could not read vendor plan" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    already_existed: alreadyExisted,
    plan: vendorRow.plan,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test vendor-provision.test.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 5: Add the route README (matches this repo's `api/merqo/*` convention)**

```markdown
# vendor-provision

## Purpose

Push-provisioning endpoint: Merqo hub calls this to create a free-tier `vendors` row for a vendor who hasn't signed up on qkit directly yet, keyed on their existing (shared) `auth.users.id`. Companion to `vendor-status` (read) — this is the write direction.

## Contents

- `route.ts` — `POST(request)`. Guarded by `provisionBearerOk()` — a DIFFERENT secret (`MERQO_PROVISION_SECRET`) from `vendor-status`/`metrics`'s `MERQO_METRICS_SECRET`, since this is a write capability. Body validated as `{ user_id: string (uuid) }`. Inserts into `vendors` (id only — `plan` defaults to `'free'` at the column level); a `23505` (already exists) is treated as success, not an error. On first creation, also seeds the shared `merqo.vendor_profile` via `getOrCreateVendorProfile(supabase, user_id, null)` (same call `onboarding/actions.ts`'s `createVendor` makes, `null` stall name since no vendor input exists here). A `23503` (unknown `user_id` — no matching `auth.users` row) returns `400`. Always reads back and returns the vendor's current `plan`, whether this call created the row or it already existed.

## Connectivity

Calls `createServiceClient()`, `provisionBearerOk()` (`@/lib/merqo-auth`), and `getOrCreateVendorProfile()` (`@/lib/merqo-vendor-profile`, also used by `onboarding/actions.ts`).

## Parent

[merqo](../README.md)
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/merqo/vendor-provision/ test/api/merqo/vendor-provision.test.ts
git commit -m "feat: add qkit vendor-provision endpoint"
```

---

### Task 4: loopkit — `provision_default_program` SQL function (migration)

**Files:**

- Create: `supabase/migrations/0032_loopkit_provision_default_program.sql`
- Modify: `supabase/tests/rls.test.sql` (add 2 grant-check assertions)

**Interfaces:**

- Produces: `loopkit.provision_default_program(p_vendor_id uuid) returns uuid` — `SECURITY DEFINER`, granted to `service_role` ONLY.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0032_loopkit_provision_default_program.sql

-- Discovered while planning vendor push-provisioning (2026-07-28 design):
-- the existing create_program RPC is SECURITY DEFINER but keyed on the
-- CALLING session's auth.uid() (raises 'not authorized' if null) — a
-- service-role call has no user session, so create_program cannot be used
-- to provision a program on a vendor's behalf. This is a narrowly-scoped
-- replacement: same insert shape as create_program's stamp-type branch,
-- keyed on an explicit parameter instead, granted ONLY to service_role so
-- it can never become a second, uncapped way for a vendor to create
-- programs for themselves (create_program's free-tier active-program cap
-- must stay the only path an authenticated vendor has).
create or replace function loopkit.provision_default_program(p_vendor_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into loopkit.programs
    (vendor_id, type, name, stamps_required, reward_text, config, active)
  values (
    p_vendor_id, 'stamp', 'Starter', 10, '1 free item',
    '{"stamps_required": 10, "reward_text": "1 free item", "points_per_visit": 1, "variant": "dots"}'::jsonb,
    true
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function loopkit.provision_default_program(uuid) from public;
grant execute on function loopkit.provision_default_program(uuid) to service_role;
-- Task 4 review correction: config must duplicate stamps_required/reward_text
-- (resolveStampConfig in src/lib/engine/index.ts reads programs.config as-is
-- whenever non-empty, never merging in the table columns as a fallback) —
-- the original draft omitted these two keys, which breaks the dashboard's
-- progress/reward-eligibility display for every auto-provisioned vendor.
-- deliberately NOT granted to authenticated
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset` (or `supabase migration up`).

- [ ] **Step 3: Write the failing pgTAP assertions**

Add to `supabase/tests/rls.test.sql`, bump the plan count by 2 (from `select plan(19);` to `select plan(21);`), and append near the end (after the existing assertions, before `select * from finish(); rollback;` if that's the file's ending — check the file's tail first):

```sql
-- provision_default_program: service_role-only, never authenticated —
-- this function bypasses create_program's own auth.uid()-based ownership
-- check by design (explicit p_vendor_id param), so its grant must be
-- exactly as narrow as intended.
select ok(
  has_function_privilege('service_role', 'loopkit.provision_default_program(uuid)', 'EXECUTE'),
  'service_role can execute provision_default_program');
select ok(
  not has_function_privilege('authenticated', 'loopkit.provision_default_program(uuid)', 'EXECUTE'),
  'authenticated cannot execute provision_default_program');
```

- [ ] **Step 4: Run the pgTAP suite to verify it fails, then passes**

Run: `supabase test db`
Before Step 1 migration is applied: fails (function doesn't exist).
After: passes, 21/21.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0032_loopkit_provision_default_program.sql supabase/tests/rls.test.sql
git commit -m "feat: add service_role-only provision_default_program function"
```

---

### Task 5: loopkit — `vendor-provision` route

**Files:**

- Modify: `src/lib/merqo-auth.ts` (loopkit has its own copy, per this repo's existing "ported verbatim" convention)
- Create: `src/app/api/merqo/vendor-provision/route.ts`
- Create: `src/app/api/merqo/vendor-provision/README.md`
- Create: `test/api/merqo/vendor-provision.test.ts`

**Interfaces:**

- Consumes: `provision_default_program` RPC (Task 4).
- Produces: same contract as qkit's route (Task 3) — `POST /api/merqo/vendor-provision`, `{ ok: true, already_existed: boolean, plan: "free" | "pro" }`.

- [ ] **Step 1: Add `provisionBearerOk` — check loopkit's `merqo-auth.ts` first**

Loopkit's vendor-status route defines `bearerOk` inline in its own route file (per the earlier "ported verbatim from qkit's bearerOk" comment), not in a shared `src/lib/merqo-auth.ts` — confirm this before writing:

Run: `grep -rn "function bearerOk" src` (from loopkit's root)

If `bearerOk` lives inline in `vendor-status/route.ts` only (no shared lib file), add a new shared `src/lib/merqo-auth.ts` with just `provisionBearerOk` (do not refactor the existing inline `bearerOk` — out of scope, leave it as-is):

```ts
// src/lib/merqo-auth.ts (new file if it doesn't already exist)
import { timingSafeEqual } from "node:crypto";

/** Constant-time bearer check against MERQO_PROVISION_SECRET — a DIFFERENT
 *  env var from vendor-status/metrics's MERQO_METRICS_SECRET, since this
 *  guards a write endpoint. Mirrors qkit's provisionBearerOk verbatim. */
export function provisionBearerOk(request: Request): boolean {
  const secret = process.env.MERQO_PROVISION_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
```

If a shared `src/lib/merqo-auth.ts` already exists (double check — the repo may have added one since the vendor-status route was written), add `provisionBearerOk` to it instead of creating a new file, following whatever export style that file already uses.

- [ ] **Step 2: Write the failing test**

```ts
// test/api/merqo/vendor-provision.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

import { POST } from "@/app/api/merqo/vendor-provision/route";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function req(body: unknown, auth?: string) {
  return new Request("http://localhost/api/merqo/vendor-provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

// loopkit's own resolveVendorStatus (src/lib/merqo-vendor-status.ts) derives
// plan from vendor_pro row existence, NOT a vendors.plan column — mirror
// that exactly here, so `fromMock` must branch on which table is queried.
function tables(opts: {
  insertError?: { code: string; message: string } | null;
  isPro?: boolean;
  proReadError?: { message: string } | null;
}) {
  return (table: string) => {
    if (table === "vendors") {
      return {
        insert: () => Promise.resolve({ error: opts.insertError ?? null }),
      };
    }
    if (table === "vendor_pro") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts.isPro ? { vendor_id: USER_ID } : null,
                error: opts.proReadError ?? null,
              }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };
}

describe("POST /api/merqo/vendor-provision (loopkit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = "test-secret";
    rpcMock.mockResolvedValue({ data: "new-program-id", error: null });
  });

  it("401 when the bearer is missing", async () => {
    const res = await POST(req({ user_id: USER_ID }));
    expect(res.status).toBe(401);
  });

  it("creates the vendor row AND calls provision_default_program on first provision", async () => {
    fromMock.mockImplementation(tables({ insertError: null, isPro: false }));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: false,
      plan: "free",
    });
    expect(rpcMock).toHaveBeenCalledWith("provision_default_program", {
      p_vendor_id: USER_ID,
    });
  });

  it("re-provision (already exists) does NOT call provision_default_program again", async () => {
    fromMock.mockImplementation(
      tables({
        insertError: { code: "23505", message: "duplicate key" },
        isPro: false,
      }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: true,
      plan: "free",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("reports plan pro when the vendor already has a vendor_pro row", async () => {
    fromMock.mockImplementation(
      tables({
        insertError: { code: "23505", message: "duplicate key" },
        isPro: true,
      }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: true,
      plan: "pro",
    });
  });

  it("500 when provision_default_program errors", async () => {
    fromMock.mockImplementation(tables({ insertError: null, isPro: false }));
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(500);
  });

  it("400 on a foreign-key violation (unknown user_id)", async () => {
    fromMock.mockImplementation(
      tables({ insertError: { code: "23503", message: "fk violation" } }),
    );
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test vendor-provision.test.ts`
Expected: FAIL — route doesn't exist.

- [ ] **Step 4: Write the route**

```ts
// src/app/api/merqo/vendor-provision/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { provisionBearerOk } from "@/lib/merqo-auth";

export const revalidate = 0;

const bodySchema = z.object({ user_id: z.string().uuid() });

export async function POST(request: Request) {
  if (!provisionBearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const { user_id } = parsed.data;

  const supabase = await createServiceClient();

  const { error: insertError } = await supabase
    .from("vendors")
    .insert({ vendor_id: user_id });
  const alreadyExisted = insertError?.code === "23505";
  if (insertError && !alreadyExisted) {
    if (insertError.code === "23503") {
      return NextResponse.json({ error: "Unknown user_id" }, { status: 400 });
    }
    console.error("vendor-provision: insert failed", insertError.message);
    return NextResponse.json(
      { error: "Could not provision vendor" },
      { status: 500 },
    );
  }

  if (!alreadyExisted) {
    const { error: rpcError } = await supabase.rpc(
      "provision_default_program",
      { p_vendor_id: user_id },
    );
    if (rpcError) {
      console.error(
        "vendor-provision: default program creation failed",
        rpcError.message,
      );
      return NextResponse.json(
        { error: "Could not provision vendor" },
        { status: 500 },
      );
    }
  }

  // loopkit has no vendors.plan column — plan is derived from vendor_pro row
  // existence, exactly like src/lib/merqo-vendor-status.ts's
  // resolveVendorStatus already does for the vendor-status route. Mirror
  // that derivation here rather than reading a plan column that doesn't
  // exist.
  const { data: proRow, error: proReadError } = await supabase
    .from("vendor_pro")
    .select("vendor_id")
    .eq("vendor_id", user_id)
    .maybeSingle();
  if (proReadError) {
    console.error(
      "vendor-provision: vendor_pro read-back failed",
      proReadError.message,
    );
    return NextResponse.json(
      { error: "Could not read vendor plan" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    already_existed: alreadyExisted,
    plan: proRow ? "pro" : "free",
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test vendor-provision.test.ts`
Expected: PASS, all 6 cases.

- [ ] **Step 6: Add the route README**

```markdown
# vendor-provision

## Purpose

Push-provisioning endpoint: Merqo hub calls this to activate loopkit for a vendor who hasn't signed up directly, keyed on their existing (shared) `auth.users.id`. Creates the vendor row AND a default "Starter" stamp program (loopkit's own `create_program` RPC can't be used here — see `provision_default_program`'s migration comment) so the vendor is genuinely active immediately, not left without a program.

## Contents

- `route.ts` — `POST(request)`. Guarded by `provisionBearerOk()` (`MERQO_PROVISION_SECRET`, distinct from `vendor-status`/`metrics`'s `MERQO_METRICS_SECRET`). Inserts into `vendors`; a `23505` is treated as already-provisioned, not an error. On first creation only, calls `loopkit.provision_default_program(p_vendor_id)` (service-role-only RPC) to create one default stamp program — never on re-provision, so an existing/customized program is never touched.

## Connectivity

Calls `createServiceClient()`, `provisionBearerOk()`, and the `provision_default_program` RPC (`supabase/migrations/0032_loopkit_provision_default_program.sql`).

## Parent

[merqo](../README.md)
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/merqo-auth.ts src/app/api/merqo/vendor-provision/ test/api/merqo/vendor-provision.test.ts
git commit -m "feat: add loopkit vendor-provision endpoint with default program"
```

---

### Task 6: Merqo — extend `vendor-sync.ts` with provisioning

**Files:**

- Modify: `src/lib/vendor-sync.ts`
- Modify: `test/lib/vendor-sync.test.ts`

**Interfaces:**

- Consumes: `RegistryRow` (Task 1), `listLiveProducts()` (Task 1).
- Produces: `provisionVendorKit(kit, userId, opts?): Promise<ProvisionResult>`, `provisionVendorKits(user: {id, email}, slugs: string[]): Promise<{ links: VendorLink[]; results: ProvisionResult[] }>` — consumed by Task 7's server action.

- [ ] **Step 1: Write the failing tests**

In `test/lib/vendor-sync.test.ts`, merge `provisionVendorKit`, `provisionVendorKits`, and the `ProvisionResult` type into the existing top-of-file import from `@/lib/vendor-sync` (do not add a second, duplicate import from the same module):

```ts
import {
  checkVendorStatus,
  upsertsFromChecks,
  provisionVendorKit,
  provisionVendorKits,
  type ProvisionResult,
} from "@/lib/vendor-sync";
```

Then add the following below the existing `describe` blocks:

```ts
const provisionKit = {
  slug: "qkit",
  app_url: "https://qkit.vercel.app",
  provision_secret: "p",
};

describe("provisionVendorKit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls the kit's vendor-provision endpoint with the bearer and user_id", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, already_existed: false, plan: "free" }),
          { status: 200 },
        ),
      );
    const r = await provisionVendorKit(provisionKit, "u1");
    expect(r).toEqual({
      ok: true,
      slug: "qkit",
      alreadyExisted: false,
      plan: "free",
    });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit.vercel.app/api/merqo/vendor-provision",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer p",
    );
    expect(JSON.parse(init.body as string)).toEqual({ user_id: "u1" });
  });

  it("ok:false when fetch throws, after exactly one retry", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await provisionVendorKit(provisionKit, "u1", { retryDelayMs: 1 });
    expect(r).toEqual({ ok: false, slug: "qkit" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the retry after an initial failure", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, already_existed: true, plan: "free" }),
          { status: 200 },
        ),
      );
    const r = await provisionVendorKit(provisionKit, "u1", { retryDelayMs: 1 });
    expect(r).toEqual({
      ok: true,
      slug: "qkit",
      alreadyExisted: true,
      plan: "free",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("ok:false when the kit has no app_url or provision_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await provisionVendorKit(
      { slug: "ghostkit", app_url: null, provision_secret: null },
      "u1",
    );
    expect(r).toEqual({ ok: false, slug: "ghostkit" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("provisionVendorKits", () => {
  afterEach(() => vi.restoreAllMocks());

  it("upserts vendor_links only for successful provisions, one failure doesn't block the other", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("qkit")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                already_existed: false,
                plan: "free",
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error("ECONNREFUSED"));
      },
    );
    // listLiveProducts is exercised via the real DB in Task 1's test; here
    // we only need provisionVendorKits's fan-out logic, so this test lives
    // alongside the others in this file and relies on the same local
    // Supabase instance already required by this file's DB-backed tests.
    const { results } = await provisionVendorKits(
      { id: "u1", email: "v@x.com" },
      ["qkit", "loopkit"],
    );
    const bySlug = new Map(results.map((r) => [r.slug, r]));
    expect(bySlug.get("qkit")?.ok).toBe(true);
    expect(bySlug.get("loopkit")?.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test vendor-sync.test.ts`
Expected: FAIL — `provisionVendorKit`/`provisionVendorKits` not exported yet.

- [ ] **Step 3: Implement in `src/lib/vendor-sync.ts`**

Append to the existing file (do not modify `checkVendorStatus`/`upsertsFromChecks`/`syncVendorKits`):

```ts
type ProvisionSource = Pick<
  RegistryRow,
  "slug" | "app_url" | "provision_secret"
>;

export type ProvisionResult =
  | { ok: true; slug: string; alreadyExisted: boolean; plan: string | null }
  | { ok: false; slug: string };

const provisionResponseSchema = z.object({
  ok: z.literal(true),
  already_existed: z.boolean(),
  plan: z.enum(["free", "pro"]),
});

async function provisionOnce(
  kit: ProvisionSource,
  userId: string,
  timeoutMs: number,
): Promise<ProvisionResult> {
  if (!kit.app_url || !kit.provision_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-provision", kit.app_url);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.provision_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
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
    const parsed = provisionResponseSchema.safeParse(json);
    if (!parsed.success) return { ok: false, slug: kit.slug };
    return {
      ok: true,
      slug: kit.slug,
      alreadyExisted: parsed.data.already_existed,
      plan: parsed.data.plan,
    };
  } catch {
    return { ok: false, slug: kit.slug };
  } finally {
    clearTimeout(timer);
  }
}

/** Push-creates a vendor's tenant row on one kit. Never throws. One
 *  automatic retry on failure (short fixed delay, not a backoff series —
 *  this is a single low-volume internal call, not a public-facing
 *  webhook) — retry ownership lives HERE only, never inside a kit's own
 *  route, so retries can't compound across layers. 3s timeout per attempt
 *  (shorter than checkVendorStatus's 5s — this blocks a user-initiated
 *  write, not a best-effort background check). */
export async function provisionVendorKit(
  kit: ProvisionSource,
  userId: string,
  opts: { timeoutMs?: number; retryDelayMs?: number } = {},
): Promise<ProvisionResult> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const first = await provisionOnce(kit, userId, timeoutMs);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 1500));
  return provisionOnce(kit, userId, timeoutMs);
}

/** Provisions every slug in `slugs` (a subset of the live registry) in
 *  parallel via allSettled — never Promise.all, one kit's failure must
 *  never mask another's success. Upserts vendor_links only for
 *  successful provisions and returns both the vendor's current links AND
 *  the raw per-kit outcome list, so the caller can render partial
 *  results (which kit succeeded, which still failed after the retry). */
export async function provisionVendorKits(
  user: { id: string; email: string },
  slugs: string[],
): Promise<{ links: VendorLink[]; results: ProvisionResult[] }> {
  const supabase = await createServiceClient();
  const allLive = await listLiveProducts();
  const targets = allLive.filter((k) => slugs.includes(k.slug));

  const settled = await Promise.allSettled(
    targets.map((kit) => provisionVendorKit(kit, user.id)),
  );
  const results: ProvisionResult[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : { ok: false, slug: targets[i].slug },
  );

  const successes = results.filter(
    (r): r is Extract<ProvisionResult, { ok: true }> => r.ok,
  );
  if (successes.length > 0) {
    const nowIso = new Date().toISOString();
    const upserts = successes.map((s) => ({
      email: user.email.toLowerCase(),
      product_slug: s.slug,
      status: "active" as const,
      last_verified_at: nowIso,
      plan: s.plan,
    }));
    const { error } = await supabase
      .from("vendor_links")
      .upsert(upserts, { onConflict: "email,product_slug" });
    if (error) {
      console.error("provisionVendorKits: upsert failed", error.message);
    }
  }

  const { data, error: readError } = await supabase
    .from("vendor_links")
    .select("product_slug, status, plan")
    .eq("email", user.email.toLowerCase());
  if (readError) {
    console.error("provisionVendorKits: read failed", readError.message);
    return { links: [], results };
  }
  return { links: (data ?? []) as VendorLink[], results };
}
```

This file already imports `z` from `"zod"` and `RegistryRow`/`listLiveProducts` from `"@/lib/products"` at the top — no new imports needed beyond what's already there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test vendor-sync.test.ts`
Expected: PASS. Note the `provisionVendorKits` fan-out test requires a local Supabase instance (`supabase start`) with Task 1's migration applied, matching this file's existing DB-backed test style.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor-sync.ts test/lib/vendor-sync.test.ts
git commit -m "feat: add provisionVendorKit/provisionVendorKits fan-out"
```

---

### Task 7: Merqo — `activateKitsAction` server action

**Files:**

- Create: `src/app/actions/activate-kits.ts`
- Create: `test/app/actions/activate-kits.test.ts`

**Interfaces:**

- Consumes: `provisionVendorKits` (Task 6), `loadVendorContext` (existing, `@/lib/vendor`).
- Produces: `activateKitsAction(slugs: string[]): Promise<ActivateKitsResult>` where `ActivateKitsResult = { success: true; results: ProvisionResult[] } | { success: false; error: string }` — consumed by Task 8's UI components.

- [ ] **Step 1: Write the failing test**

```ts
// test/app/actions/activate-kits.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadVendorContextMock, provisionVendorKitsMock, revalidatePathMock } =
  vi.hoisted(() => ({
    loadVendorContextMock: vi.fn(),
    provisionVendorKitsMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));
vi.mock("@/lib/vendor", () => ({ loadVendorContext: loadVendorContextMock }));
vi.mock("@/lib/vendor-sync", () => ({
  provisionVendorKits: provisionVendorKitsMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { activateKitsAction } from "@/app/actions/activate-kits";

describe("activateKitsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an error when not signed in", async () => {
    loadVendorContextMock.mockResolvedValue({ user: null, links: [] });
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: false,
      error: "Please sign in first.",
    });
    expect(provisionVendorKitsMock).not.toHaveBeenCalled();
  });

  it("calls provisionVendorKits for the signed-in vendor and revalidates the dashboard", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      links: [],
    });
    provisionVendorKitsMock.mockResolvedValue({
      links: [{ product_slug: "qkit", status: "active", plan: "free" }],
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
      ],
    });
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
      ],
    });
    expect(provisionVendorKitsMock).toHaveBeenCalledWith(
      { id: "u1", email: "v@x.com" },
      ["qkit"],
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a generic error when provisionVendorKits throws", async () => {
    loadVendorContextMock.mockResolvedValue({
      user: { id: "u1", email: "v@x.com" },
      links: [],
    });
    provisionVendorKitsMock.mockRejectedValue(new Error("boom"));
    const res = await activateKitsAction(["qkit"]);
    expect(res).toEqual({
      success: false,
      error: "Could not activate your kits. Try again in a moment.",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test activate-kits.test.ts`
Expected: FAIL — action file doesn't exist.

- [ ] **Step 3: Write the action**

```ts
// src/app/actions/activate-kits.ts
"use server";

import { revalidatePath } from "next/cache";
import { loadVendorContext } from "@/lib/vendor";
import { provisionVendorKits, type ProvisionResult } from "@/lib/vendor-sync";

export type ActivateKitsResult =
  | { success: true; results: ProvisionResult[] }
  | { success: false; error: string };

const GENERIC_ERROR = "Could not activate your kits. Try again in a moment.";

/** Provisions the signed-in vendor into every slug in `slugs` (bulk
 *  "Activate all my kits" passes every kit currently supporting
 *  provisioning; a single-kit "Add {kit}" passes one). */
export async function activateKitsAction(
  slugs: string[],
): Promise<ActivateKitsResult> {
  const { user } = await loadVendorContext();
  if (!user?.email) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const { results } = await provisionVendorKits(
      { id: user.id, email: user.email },
      slugs,
    );
    revalidatePath("/dashboard");
    return { success: true, results };
  } catch (err) {
    console.error("activateKitsAction: unexpected failure", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test activate-kits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/activate-kits.ts test/app/actions/activate-kits.test.ts
git commit -m "feat: add activateKitsAction server action"
```

---

### Task 8: Merqo — dashboard UI (bulk button, upgraded per-kit CTA, partial-failure rendering)

**Files:**

- Create: `src/components/dashboard/activate-kits-button.tsx`
- Modify: `src/app/dashboard/pending/page.tsx`
- Modify: `src/app/dashboard/(app)/page.tsx`
- Modify: `src/components/dashboard/kit-discovery-card.tsx` (no change needed — `cta` slot already accepts any `React.ReactNode`, just pass a different node)
- Create: `test/components/activate-kits-button.test.tsx` (flat under `test/components/`, matching the existing sibling `test/components/join-waitlist-button.test.tsx` — not nested under a `dashboard/` subfolder)

**Interfaces:**

- Consumes: `activateKitsAction` (Task 7).
- Produces: `<ActivateKitsButton slugs={string[]} label={string} />` — a client component usable both as the bulk primary CTA and as a single-slug per-kit "Add" button.

- [ ] **Step 1: Write the failing test**

Matches this repo's existing component-test convention exactly (see `test/components/join-waitlist-button.test.tsx`): `// @vitest-environment jsdom` pragma, `vi.mock` + `vi.mocked(...)`, not `vi.hoisted`.

```tsx
// test/components/activate-kits-button.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/activate-kits", () => ({
  activateKitsAction: vi.fn(),
}));

import { activateKitsAction } from "@/app/actions/activate-kits";
import { ActivateKitsButton } from "@/components/dashboard/activate-kits-button";

describe("ActivateKitsButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables while pending and re-enables after resolving", async () => {
    let resolveAction: (v: unknown) => void = () => {};
    vi.mocked(activateKitsAction).mockReturnValue(
      new Promise((r) => (resolveAction = r as typeof resolveAction)),
    );
    render(
      <ActivateKitsButton
        slugs={["qkit", "loopkit"]}
        label="Activate all my kits"
      />,
    );
    const button = screen.getByRole("button", { name: "Activate all my kits" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    resolveAction({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
        { ok: true, slug: "loopkit", alreadyExisted: false, plan: "free" },
      ],
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("renders a per-kit retry affordance for a kit that failed, not a page-level error", async () => {
    vi.mocked(activateKitsAction).mockResolvedValue({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
        { ok: false, slug: "loopkit" },
      ],
    });
    render(
      <ActivateKitsButton
        slugs={["qkit", "loopkit"]}
        label="Activate all my kits"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Activate all my kits" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry loopkit" }),
      ).toBeInTheDocument(),
    );
    // the succeeded kit must NOT also show a retry affordance
    expect(
      screen.queryByRole("button", { name: "Retry qkit" }),
    ).not.toBeInTheDocument();
  });

  it("clicking a single kit's retry re-invokes the action with only that slug", async () => {
    vi.mocked(activateKitsAction)
      .mockResolvedValueOnce({
        success: true,
        results: [{ ok: false, slug: "loopkit" }],
      })
      .mockResolvedValueOnce({
        success: true,
        results: [
          { ok: true, slug: "loopkit", alreadyExisted: false, plan: "free" },
        ],
      });
    render(<ActivateKitsButton slugs={["loopkit"]} label="Add loopkit" />);
    fireEvent.click(screen.getByRole("button", { name: "Add loopkit" }));
    const retryButton = await screen.findByRole("button", {
      name: "Retry loopkit",
    });
    fireEvent.click(retryButton);
    await waitFor(() =>
      expect(activateKitsAction).toHaveBeenLastCalledWith(["loopkit"]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test activate-kits-button`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// src/components/dashboard/activate-kits-button.tsx
"use client";

import { useState, useTransition } from "react";
import { activateKitsAction } from "@/app/actions/activate-kits";
import { Button } from "@/components/ui/button";
import type { ProvisionResult } from "@/lib/vendor-sync";

/** Bulk ("Activate all my kits", multiple slugs) or single-kit ("Add
 *  {kit}", one slug) activation button — same component, driven entirely
 *  by `slugs`, never a hardcoded count. Renders per-kit failure/retry
 *  affordances rather than one aggregate success/error message — a
 *  partial failure must never look like a page-level error. */
export function ActivateKitsButton({
  slugs,
  label,
}: {
  slugs: string[];
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ProvisionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function activate(targetSlugs: string[]) {
    startTransition(async () => {
      const res = await activateKitsAction(targetSlugs);
      if (res.success) {
        setError(null);
        setResults((prev) => {
          const bySlug = new Map((prev ?? []).map((r) => [r.slug, r]));
          for (const r of res.results) bySlug.set(r.slug, r);
          return Array.from(bySlug.values());
        });
      } else {
        setError(res.error);
      }
    });
  }

  const failed = (results ?? []).filter((r) => !r.ok);

  return (
    <div>
      <Button type="button" onClick={() => activate(slugs)} disabled={pending}>
        {pending ? "Activating…" : label}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {failed.length > 0 && (
        <ul className="mt-2 space-y-1">
          {failed.map((r) => (
            <li key={r.slug} className="text-xs text-destructive">
              Couldn&apos;t activate {r.slug} —{" "}
              <button
                type="button"
                onClick={() => activate([r.slug])}
                disabled={pending}
                className="font-medium underline disabled:opacity-60"
                aria-label={`Retry ${r.slug}`}
              >
                Retry {r.slug}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test activate-kits-button`
Expected: PASS.

- [ ] **Step 5: Wire the bulk button into `/dashboard/pending` (primary CTA, per the decided emphasis)**

In `src/app/dashboard/pending/page.tsx`, replace the single-kit `KitDiscoveryCard` block (currently rendering a dumb `<a href="{featured.href}/login">Add {featured.name}</a>` link) with the bulk button as the primary CTA, computing the addable slugs from `addableKits(links)`:

```tsx
// Add to imports at the top:
import { ActivateKitsButton } from "@/components/dashboard/activate-kits-button";

// Replace the existing `const featured = addableKits(links)[0];` line and
// the `{featured?.href && (...)}` block below it with:
const addable = addableKits(links);

// ... (unchanged JSX above this point) ...

{
  addable.length > 0 && (
    <div className="mt-6">
      <ActivateKitsButton
        slugs={addable.map((k) => k.slug)}
        label={
          addable.length > 1 ? "Activate all my kits" : `Add ${addable[0].name}`
        }
      />
    </div>
  );
}
```

Remove the now-unused `KitDiscoveryCard` import/usage from this file if nothing else in it still references it (check the rest of the file first — `KitDiscoveryCard` is currently imported here specifically for this one block).

- [ ] **Step 6: Upgrade the per-kit "Add {kit}" CTA in `/dashboard`'s "Ready to add" section**

In `src/app/dashboard/(app)/page.tsx`, inside the `readyToAdd.map(...)` block, replace:

```tsx
cta={
  kit.href && (
    <a
      href={`${kit.href}/login`}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium text-foreground hover:underline"
    >
      Add {kit.name}
    </a>
  )
}
```

with:

```tsx
cta={
  <ActivateKitsButton slugs={[kit.slug]} label={`Add ${kit.name}`} />
}
```

Add the import at the top of this file: `import { ActivateKitsButton } from "@/components/dashboard/activate-kits-button";`. This drops the `kit.href` guard — `ActivateKitsButton` doesn't need `href`, only `slug`; if `readyToAdd`'s existing `Kit` filter already requires `status === "live"` (it does, per `addableKits`), every kit reaching this point supports provisioning.

- [ ] **Step 7: Manually verify both pages render correctly**

Run: `pnpm dev`, sign in as a vendor with zero active kits, confirm `/dashboard/pending` shows the bulk button (or single "Add {kit}" if only one live kit is addable) instead of the old dead link; sign in as a vendor with one active kit, confirm `/dashboard`'s "Ready to add" section shows individual "Add {kit}" buttons that actually activate instead of opening a new tab.

- [ ] **Step 8: Run full test suite and typecheck**

Run: `pnpm check && pnpm test`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/activate-kits-button.tsx src/app/dashboard/pending/page.tsx "src/app/dashboard/(app)/page.tsx" test/components/activate-kits-button.test.tsx
git commit -m "feat: wire one-click kit activation into the dashboard"
```

---

### Task 9: Operator step — secrets and follow-up tracking (not app code)

**Files:**

- Modify: `.env.example` in qkit, loopkit, and merqo (add `MERQO_PROVISION_SECRET=`, following the exact existing line for `MERQO_METRICS_SECRET=` in each file — read the surrounding lines first with `Read`, since the exact comment/formatting must match this repo's existing convention rather than being invented here)
- No code changes beyond `.env.example` — the rest of this task is manual, operator-run

**Interfaces:** None — this task produces no importable code, only configuration required for Tasks 1–8 to work end-to-end outside of tests.

- [ ] **Step 1: Add `MERQO_PROVISION_SECRET` to each repo's `.env.example`**

Read each repo's current `.env.example` first to match its exact existing `MERQO_METRICS_SECRET` line's comment style, then add an equivalent `MERQO_PROVISION_SECRET=` line directly after it in qkit, loopkit, and merqo.

- [ ] **Step 2: Generate one shared secret value and set it as an actual env var**

Run once: `openssl rand -hex 32` (or equivalent) to generate a value. Set `MERQO_PROVISION_SECRET` to this SAME value in qkit's, loopkit's, and Merqo hub's actual environment (Vercel project settings for each, plus local `.env.local` for local dev) — this is the shared secret all three sides check against, analogous to how `MERQO_METRICS_SECRET` is already configured. Confirm the value is DIFFERENT from the existing `MERQO_METRICS_SECRET` value.

- [ ] **Step 3: Populate `merqo.products.provision_secret` for qkit and loopkit**

Via the Supabase SQL editor (never committed to a migration — same handling as the existing `metrics_secret` column):

```sql
update merqo.products set provision_secret = '<the same value from Step 2>' where slug in ('qkit', 'loopkit');
```

- [ ] **Step 4: End-to-end smoke test against real (or local) deployments**

With all three apps running (locally via `pnpm dev` in each, or against real Vercel deployments) and the migrations from Tasks 1 and 4 applied: sign up a fresh test vendor on Merqo hub, land on `/dashboard/pending`, click "Activate all my kits", confirm both qkit and loopkit show as active tiles, confirm qkit's `vendors` table and loopkit's `vendors`+`programs` tables each have a new row for that vendor.

- [ ] **Step 5: Commit the `.env.example` changes only**

```bash
git add .env.example
git commit -m "docs: add MERQO_PROVISION_SECRET to .env.example"
```

(Run this commit separately in each of the three repos — qkit, loopkit, merqo.)

---

## Deferred (not in this plan, tracked in the spec's Open Questions)

- paykit and stockkit `vendor-provision` support — excluded from this plan's scope (paykit has zero `/api/merqo/*` routes to build from; stockkit needs a product decision on live-tier promotion first).
- Phase 2 (cross-domain SSO / true seamless kit switching) — blocked on the undated `*.merqo.net` subdomain migration.
