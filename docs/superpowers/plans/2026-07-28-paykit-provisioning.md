# paykit Push-Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give paykit its first two `/api/merqo/*` routes (`vendor-status`, `vendor-provision`) so it can join merqo hub's "Activate all my kits" flow — as a read-only identity check, never a data write — and teach merqo hub to render a distinct "finish payment setup" state (`vendor_links.status = 'needs_setup'`) instead of collapsing paykit into either "active" or a plain external link.

**Architecture:** paykit's two new routes mirror qkit/loopkit's existing `MERQO_METRICS_SECRET`/`MERQO_PROVISION_SECRET` bearer-secret contract exactly, but both routes only ever *read* `paykit.vendor_payment_config` — there is nothing safe to write, since `payee_name`/`uen`/`mobile` have no safe default (a placeholder PayNow proxy could misdirect a real payment). Merqo hub widens its `vendor_links.status` state machine from a binary `active`/`waitlist` to a third `needs_setup` value, threads it through `provisionVendorKit`/`ActivateKitsButton`, and renders a "Finish payment setup" tile linking straight to paykit's own `/dashboard/config`.

**Tech Stack:** Next.js App Router route handlers, Zod, `@supabase/ssr` service-role client, Vitest (+ `@testing-library/react` for dom tests), Postgres migrations (hermetic `readFileSync`-based tests, no live-DB hits).

## Global Constraints

- paykit's two new routes (`vendor-status`, `vendor-provision`) must never write to `paykit.vendor_payment_config` — read-only, always. (Design: "Push-provision identity only, then deep-link to config".)
- `MERQO_METRICS_SECRET` and `MERQO_PROVISION_SECRET` are separate env vars, per-kit values (paykit's own secret values, distinct from qkit's/loopkit's) — never share a secret across kits.
- Every request body/query param is Zod-validated at the route boundary before use. TypeScript strict — no `any`.
- No live-Supabase test hits anywhere in this plan — migration correctness is verified by `readFileSync`-ing the migration SQL text (matching `test/db/0013_fix_loopkit_live_status_and_provision_secret.test.ts`'s existing pattern), route/lib logic is verified with mocked Supabase clients.
- Never use `Promise.all` for multi-kit fan-out (unchanged — `provisionVendorKits` already uses `Promise.allSettled`; this plan does not touch that fan-out mechanism, only the per-kit response shape it consumes).
- Follow each repo's existing file/test conventions exactly (see each task's "Existing pattern" note) rather than introducing a new convention.

---

## Task 1: paykit — `merqo-auth.ts` (bearer-secret helpers)

**Files:**
- Create: `paykit/src/lib/merqo-auth.ts`
- Create: `paykit/src/lib/merqo-auth.test.ts`
- Modify: `paykit/src/lib/README.md` (add entry)

**Existing pattern:** qkit's `src/lib/merqo-auth.ts` already implements this exact file — paykit needs its own copy (paykit has zero `/api/merqo/*` infrastructure today; its existing `kit-auth.ts`/`verifyKitAuth` is a *different* system for peer-kit-to-kit calls like `v1/vendors/[vendor_id]/config`, keyed by a `kit_api_keys` table — do not touch or reuse it).

**Interfaces:**
- Produces: `bearerOk(request: Request): boolean`, `provisionBearerOk(request: Request): boolean`, `listAllAuthUsers(supabase, logPrefix: string)` — all three consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**

```ts
// paykit/src/lib/merqo-auth.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { bearerOk, provisionBearerOk } from "./merqo-auth";

function reqWithAuth(header?: string) {
  return new Request("http://localhost/x", {
    headers: header ? { Authorization: header } : {},
  });
}

describe("bearerOk", () => {
  afterEach(() => {
    delete process.env.MERQO_METRICS_SECRET;
  });

  it("rejects when MERQO_METRICS_SECRET is unset", () => {
    delete process.env.MERQO_METRICS_SECRET;
    expect(bearerOk(reqWithAuth("Bearer anything"))).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    process.env.MERQO_METRICS_SECRET = "s1";
    expect(bearerOk(reqWithAuth())).toBe(false);
  });

  it("rejects a wrong secret", () => {
    process.env.MERQO_METRICS_SECRET = "s1";
    expect(bearerOk(reqWithAuth("Bearer wrong"))).toBe(false);
  });

  it("accepts the correct secret", () => {
    process.env.MERQO_METRICS_SECRET = "s1";
    expect(bearerOk(reqWithAuth("Bearer s1"))).toBe(true);
  });
});

describe("provisionBearerOk", () => {
  afterEach(() => {
    delete process.env.MERQO_PROVISION_SECRET;
  });

  it("rejects when MERQO_PROVISION_SECRET is unset", () => {
    delete process.env.MERQO_PROVISION_SECRET;
    expect(provisionBearerOk(reqWithAuth("Bearer anything"))).toBe(false);
  });

  it("accepts the correct secret, independent of MERQO_METRICS_SECRET", () => {
    process.env.MERQO_PROVISION_SECRET = "p1";
    expect(provisionBearerOk(reqWithAuth("Bearer p1"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/merqo-auth.test.ts`
Expected: FAIL — `Cannot find module './merqo-auth'` (or similar; the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// paykit/src/lib/merqo-auth.ts
import { timingSafeEqual } from "node:crypto";
import type { createServiceClient } from "@/lib/supabase/server";

/** Constant-time bearer check against MERQO_METRICS_SECRET. */
export function bearerOk(request: Request): boolean {
  const secret = process.env.MERQO_METRICS_SECRET;
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

/** Constant-time bearer check against MERQO_PROVISION_SECRET — deliberately a
 *  DIFFERENT env var from bearerOk's MERQO_METRICS_SECRET, matching qkit/
 *  loopkit's convention: a leak of the routine metrics-polling secret must
 *  not also grant access to the provision route. */
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

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Fetches auth users. Only page 1 (1000 users) — once paykit passes that
 *  many, anything past this page silently drops out of every merqo lookup.
 *  Logs when that ceiling is hit so it doesn't fail invisibly. */
export async function listAllAuthUsers(
  supabase: ServiceClient,
  logPrefix: string,
) {
  const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (!usersRes.error && usersRes.data?.users.length === 1000) {
    console.error(
      `${logPrefix}: listUsers returned a full page (1000) — pagination not implemented, results past this page may be incomplete`,
    );
  }
  return usersRes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/merqo-auth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Update `src/lib/README.md`**

Add this entry to the `## Contents` list, alphabetically near `merqo-vendor-profile.ts`:

```markdown
- `merqo-auth.ts` — `bearerOk`/`provisionBearerOk` (constant-time bearer-secret
  checks against `MERQO_METRICS_SECRET`/`MERQO_PROVISION_SECRET` respectively)
  and `listAllAuthUsers`, for the `/api/merqo/*` routes merqo hub calls
  directly — a separate auth mechanism from `kit-auth.ts`'s `verifyKitAuth`
  (which is for peer-kit-to-kit calls like checkout verification, keyed by
  `kit_api_keys`).
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/merqo-auth.ts src/lib/merqo-auth.test.ts src/lib/README.md
git commit -m "feat: add merqo-auth bearer-secret helpers for merqo hub routes"
```

---

## Task 2: paykit — `GET /api/merqo/vendor-status`

**Files:**
- Create: `paykit/src/lib/merqo-vendor-status.ts`
- Create: `paykit/src/lib/merqo-vendor-status.test.ts`
- Create: `paykit/src/app/api/merqo/vendor-status/route.ts`
- Create: `paykit/src/app/api/merqo/vendor-status/route.test.ts`

**Existing pattern:** qkit's `src/lib/merqo-vendor-status.ts` (`resolveVendorStatus`) and `src/app/api/merqo/vendor-status/route.ts` — same shape, adapted from qkit's `vendors` table to paykit's `vendor_payment_config` table (both are keyed directly by `auth.users.id`, so the join logic is identical).

**Interfaces:**
- Consumes: `bearerOk`, `listAllAuthUsers` from Task 1 (`@/lib/merqo-auth`).
- Produces: `resolveVendorStatus(email, authUsers, configs): { active: boolean; plan: string | null }`, consumed only within this task's own route.

- [ ] **Step 1: Write the failing test for the pure resolver**

```ts
// paykit/src/lib/merqo-vendor-status.test.ts
import { describe, it, expect } from "vitest";
import { resolveVendorStatus } from "./merqo-vendor-status";

const AUTH_USERS = [{ id: "u1", email: "vendor@business.sg" }];

describe("resolveVendorStatus", () => {
  it("is inactive when no auth user matches the email", () => {
    expect(resolveVendorStatus("nobody@business.sg", AUTH_USERS, [])).toEqual({
      active: false,
      plan: null,
    });
  });

  it("is inactive when the auth user has no vendor_payment_config row", () => {
    expect(resolveVendorStatus("vendor@business.sg", AUTH_USERS, [])).toEqual({
      active: false,
      plan: null,
    });
  });

  it("is active with the config's plan when a row exists", () => {
    expect(
      resolveVendorStatus("vendor@business.sg", AUTH_USERS, [
        { vendor_id: "u1", plan: "pro" },
      ]),
    ).toEqual({ active: true, plan: "pro" });
  });

  it("matches email case-insensitively", () => {
    expect(
      resolveVendorStatus("VENDOR@business.sg", AUTH_USERS, [
        { vendor_id: "u1", plan: "free" },
      ]),
    ).toEqual({ active: true, plan: "free" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/merqo-vendor-status.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the pure resolver**

```ts
// paykit/src/lib/merqo-vendor-status.ts
export type VendorStatus =
  | { active: true; plan: string }
  | { active: false; plan: null };

/**
 * paykit.vendor_payment_config has no email column (vendor_id references
 * auth.users(id) directly), so the caller supplies the auth-user list
 * (from supabase.auth.admin.listUsers) alongside the config rows, and this
 * pure function does the two-step lookup — mirrors qkit's
 * merqo-vendor-status.ts resolveVendorStatus exactly.
 */
export function resolveVendorStatus(
  email: string,
  authUsers: { id: string; email: string | null }[],
  configs: { vendor_id: string; plan: string }[],
): VendorStatus {
  const key = email.toLowerCase();
  const user = authUsers.find((u) => u.email?.toLowerCase() === key);
  if (!user) return { active: false, plan: null };
  const config = configs.find((c) => c.vendor_id === user.id);
  if (!config) return { active: false, plan: null };
  return { active: true, plan: config.plan };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/merqo-vendor-status.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing route test**

```ts
// paykit/src/app/api/merqo/vendor-status/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock, listUsersMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  listUsersMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: fromMock,
    auth: { admin: { listUsers: listUsersMock } },
  })),
}));

import { GET } from "@/app/api/merqo/vendor-status/route";

function req(url: string, auth?: string) {
  return new Request(url, {
    headers: auth ? { Authorization: auth } : {},
  });
}

describe("GET /api/merqo/vendor-status (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_METRICS_SECRET = "test-secret";
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "u1", email: "vendor@business.sg" }] },
      error: null,
    });
    fromMock.mockImplementation(() => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }));
  });

  it("401 when the bearer is missing", async () => {
    const res = await GET(
      req("http://localhost/api/merqo/vendor-status?email=v@business.sg"),
    );
    expect(res.status).toBe(401);
  });

  it("400 when email is missing", async () => {
    const res = await GET(
      req("http://localhost/api/merqo/vendor-status", "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
  });

  it("reports inactive for a vendor with no config row", async () => {
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-status?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(await res.json()).toEqual({ active: false, plan: null });
  });

  it("reports active with plan for a vendor with a config row", async () => {
    fromMock.mockImplementation(() => ({
      select: () =>
        Promise.resolve({ data: [{ vendor_id: "u1", plan: "pro" }], error: null }),
    }));
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-status?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(await res.json()).toEqual({ active: true, plan: "pro" });
  });

  it("503 when the auth-users read fails", async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-status?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });

  it("503 when the config read fails", async () => {
    fromMock.mockImplementation(() => ({
      select: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    }));
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-status?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/merqo/vendor-status/route.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 7: Implement the route**

```ts
// paykit/src/app/api/merqo/vendor-status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { bearerOk, listAllAuthUsers } from "@/lib/merqo-auth";
import { resolveVendorStatus } from "@/lib/merqo-vendor-status";

export const revalidate = 0;

const querySchema = z.object({ email: z.string().email() });

export async function GET(request: Request) {
  if (!bearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    email: searchParams.get("email") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const [usersRes, configsRes] = await Promise.all([
    listAllAuthUsers(supabase, "paykit vendor-status"),
    supabase.from("vendor_payment_config").select("vendor_id, plan"),
  ]);
  if (usersRes.error) {
    console.error(
      "paykit vendor-status: read failed",
      usersRes.error.message,
    );
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (configsRes.error) {
    console.error(
      "paykit vendor-status: read failed",
      configsRes.error.message,
    );
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }

  const status = resolveVendorStatus(
    parsed.data.email,
    (usersRes.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
    })),
    (configsRes.data ?? []) as { vendor_id: string; plan: string }[],
  );

  return NextResponse.json(status);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/merqo/vendor-status/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/merqo-vendor-status.ts src/lib/merqo-vendor-status.test.ts src/app/api/merqo/vendor-status/route.ts src/app/api/merqo/vendor-status/route.test.ts
git commit -m "feat: add paykit vendor-status route for merqo hub pull-sync"
```

---

## Task 3: paykit — `POST /api/merqo/vendor-provision`

**Files:**
- Create: `paykit/src/app/api/merqo/vendor-provision/route.ts`
- Create: `paykit/src/app/api/merqo/vendor-provision/route.test.ts`

**Existing pattern:** qkit/loopkit's `vendor-provision` routes, but with the insert branch removed entirely — this route only ever reads.

**Interfaces:**
- Consumes: `provisionBearerOk` from Task 1 (`@/lib/merqo-auth`).
- Produces: HTTP contract `POST /api/merqo/vendor-provision` → `{ ok: true, needs_setup: boolean, plan: string | null }`, consumed by merqo hub's Task 7 (`provisionVendorKit`).

- [ ] **Step 1: Write the failing test**

```ts
// paykit/src/app/api/merqo/vendor-provision/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock })),
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

function configTable(row: { plan: string } | null, error: { message: string } | null = null) {
  return () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error }),
      }),
    }),
  });
}

describe("POST /api/merqo/vendor-provision (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = "test-secret";
  });

  it("401 when the bearer is missing", async () => {
    const res = await POST(req({ user_id: USER_ID }));
    expect(res.status).toBe(401);
  });

  it("400 on a malformed JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/merqo/vendor-provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: "{not valid json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when user_id fails schema validation", async () => {
    const res = await POST(req({ user_id: "not-a-uuid" }, "Bearer test-secret"));
    expect(res.status).toBe(400);
  });

  it("reports needs_setup true and never writes when no config row exists", async () => {
    fromMock.mockImplementation(configTable(null));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, needs_setup: true, plan: null });
    // Only ever reads vendor_payment_config once — no insert/update call of
    // any kind, since there is nothing safe to write.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("vendor_payment_config");
  });

  it("reports needs_setup false with the real plan when a config row already exists", async () => {
    fromMock.mockImplementation(configTable({ plan: "pro" }));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(await res.json()).toEqual({ ok: true, needs_setup: false, plan: "pro" });
  });

  it("500 when the config read errors", async () => {
    fromMock.mockImplementation(configTable(null, { message: "boom" }));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/merqo/vendor-provision/route.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement the route**

```ts
// paykit/src/app/api/merqo/vendor-provision/route.ts
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

  // Never writes: vendor_payment_config's payee_name/uen/mobile have no safe
  // default (a placeholder PayNow proxy could misdirect a real payment) —
  // this route only reports whatever is already there.
  const { data, error } = await supabase
    .from("vendor_payment_config")
    .select("plan")
    .eq("vendor_id", user_id)
    .maybeSingle();
  if (error) {
    console.error("paykit vendor-provision: read failed", error.message);
    return NextResponse.json(
      { error: "Could not read vendor payment config" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    needs_setup: !data,
    plan: data?.plan ?? null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/merqo/vendor-provision/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/merqo/vendor-provision/route.ts src/app/api/merqo/vendor-provision/route.test.ts
git commit -m "feat: add paykit vendor-provision route (read-only identity check)"
```

---

## Task 4: paykit — docs and env

**Files:**
- Modify: `paykit/CHANGELOG.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add a CHANGELOG entry**

Add under the existing `## [Unreleased]` heading's `### Added` subsection (create the subsection above `### Fixed` if it doesn't already exist):

```markdown
### Added

- `GET /api/merqo/vendor-status` and `POST /api/merqo/vendor-provision` —
  merqo hub integration routes, bearer-secured via new `MERQO_METRICS_SECRET`/
  `MERQO_PROVISION_SECRET` env vars. Both routes are read-only: paykit has no
  safe default for `vendor_payment_config`'s `payee_name`/`uen`/`mobile`
  fields, so provisioning only reports whether a vendor has already
  configured payment collection (`needs_setup: true/false`), never creates a
  placeholder row.
```

- [ ] **Step 2: Note the required env vars (manual step — do not attempt to edit `.env.example` here)**

paykit's `.env.example` needs two new lines documented for whoever deploys this:

```
MERQO_METRICS_SECRET=
MERQO_PROVISION_SECRET=
```

If your harness permissions block editing `.env.example` directly (some
harness configs deny-list all `.env*` paths even for the example file),
leave this to the human operator rather than fighting the permission — say
so explicitly in your task report instead of skipping it silently.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: document new merqo hub integration routes and env vars"
```

---

## Task 5: merqo — migration widening `vendor_links.status` + flipping paykit live

**Files:**
- Create: `merqo/supabase/migrations/0014_paykit_live_and_needs_setup_status.sql`
- Create: `merqo/test/db/0014_paykit_live_and_needs_setup_status.test.ts`
- Modify: `merqo/src/lib/vendor-grants.ts:6`

**Existing pattern:** `supabase/migrations/0013_fix_loopkit_live_status_and_provision_secret.sql` + `test/db/0013_fix_loopkit_live_status_and_provision_secret.test.ts` (hermetic `readFileSync` test, no live-DB hit).

**Interfaces:**
- Produces: `merqo.vendor_links.status` CHECK now allows `'needs_setup'`; `merqo.products` row for `paykit` has `status = 'live'`; `GrantStatus = "active" | "waitlist" | "needs_setup"`. Consumed by Task 6 (`vendor.ts`) and Task 7 (`vendor-sync.ts`).

- [ ] **Step 1: Write the failing migration test**

```ts
// merqo/test/db/0014_paykit_live_and_needs_setup_status.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0014_paykit_live_and_needs_setup_status.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0014_paykit_live_and_needs_setup_status migration", () => {
  it("updates paykit status from coming_soon to live", () => {
    expect(sql).toContain(
      "update merqo.products set status = 'live' where slug = 'paykit'",
    );
  });

  it("dynamically finds and drops the existing vendor_links status check constraint", () => {
    expect(sql).toContain("pg_constraint");
    expect(sql).toContain("vendor_links");
    expect(sql).toContain("drop constraint");
  });

  it("re-adds a named constraint allowing active, waitlist, and needs_setup", () => {
    expect(sql).toContain("vendor_links_status_check");
    expect(sql).toContain(
      "check (status in ('active', 'waitlist', 'needs_setup'))",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/db/0014_paykit_live_and_needs_setup_status.test.ts`
Expected: FAIL — migration file doesn't exist.

- [ ] **Step 3: Write the migration**

The existing `status` CHECK constraint on `merqo.vendor_links` was declared
inline on the column (see `supabase/migrations/0001_merqo_core.sql:34`) and
never given an explicit name, so Postgres auto-generated one — its exact
name has never been recorded in this codebase. Rather than guess it, this
migration finds it dynamically via `pg_constraint` and drops whatever it
finds, then adds back a NAMED constraint so future migrations can reference
it reliably:

```sql
-- Bugfix found while scoping paykit push-provisioning (2026-07-28 design):
-- paykit was seeded as 'coming_soon' in 0004_kit_consolidation.sql despite
-- src/lib/kits.ts already showing it as fully live — listLiveProducts()
-- filters on THIS column, so paykit has been silently excluded from vendor
-- auto-discovery since 0004 (same bug class as loopkit, fixed in 0013).
update merqo.products set status = 'live' where slug = 'paykit';

-- Widen vendor_links.status to a third value: 'needs_setup', for kits
-- (paykit) that can be identity-provisioned but need a further manual step
-- (real PayNow/bank details) before they're truly active. The original
-- CHECK (0001_merqo_core.sql:34) was declared inline with no explicit name,
-- so its Postgres-assigned name isn't recorded anywhere in this codebase —
-- find and drop it dynamically instead of guessing, then re-add a named
-- constraint so it's unambiguous from here on.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'merqo'
    and rel.relname = 'vendor_links'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if existing_constraint is not null then
    execute format(
      'alter table merqo.vendor_links drop constraint %I',
      existing_constraint
    );
  end if;

  alter table merqo.vendor_links
    add constraint vendor_links_status_check
    check (status in ('active', 'waitlist', 'needs_setup'));
end $$;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/0014_paykit_live_and_needs_setup_status.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Apply the migration locally and confirm it runs clean**

Run: `supabase db reset` (requires local Supabase running — `supabase start` first if not already)
Expected: migration applies with no errors; this also confirms the dynamic
constraint-name lookup actually finds and replaces the real constraint
against a real schema, which the hermetic test above cannot verify on its
own.

- [ ] **Step 6: Widen the `GrantStatus` type**

In `merqo/src/lib/vendor-grants.ts`, change line 6:

```ts
export type GrantStatus = "active" | "waitlist" | "needs_setup";
```

- [ ] **Step 7: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: passes (this is a widening change — no existing `GrantStatus`
consumer narrows it in a way that would now fail to compile; Tasks 6-9
below are exactly the places that need to actually *handle* the new value).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0014_paykit_live_and_needs_setup_status.sql test/db/0014_paykit_live_and_needs_setup_status.test.ts src/lib/vendor-grants.ts
git commit -m "feat: flip paykit live and add needs_setup vendor_links status"
```

---

## Task 6: merqo — `tilesForLinks` third bucket (`needsSetup`)

**Files:**
- Modify: `merqo/src/lib/vendor.ts:51-74` (the `tilesForLinks` function)
- Create: `merqo/src/lib/vendor.test.ts`

**Interfaces:**
- Consumes: `GrantStatus` (now includes `"needs_setup"`, from Task 5).
- Produces: `tilesForLinks(links): { active: KitTile[]; pending: KitTile[]; needsSetup: KitTile[] }` — the `needsSetup` array is new; `active`/`pending` keep their existing meaning (`pending` is now specifically "waitlist", not "everything non-active"). Consumed by Task 9 (dashboard pages).

- [ ] **Step 1: Write the failing test**

```ts
// merqo/src/lib/vendor.test.ts
import { describe, it, expect } from "vitest";
import { tilesForLinks } from "./vendor";

describe("tilesForLinks", () => {
  it("buckets active, waitlist, and needs_setup links separately", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "shopkit", status: "waitlist", plan: null },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(pending.map((t) => t.slug)).toEqual(["shopkit"]);
    expect(needsSetup.map((t) => t.slug)).toEqual(["paykit"]);
  });

  it("drops a link to a slug KITS doesn't know about, in any bucket", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "unknown-kit", status: "needs_setup", plan: null },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
    expect(needsSetup).toEqual([]);
  });

  it("never sets plan on a needs_setup tile (plan only means anything once active)", () => {
    const { needsSetup } = tilesForLinks([
      { product_slug: "paykit", status: "needs_setup", plan: "pro" },
    ]);
    expect(needsSetup[0].plan).toBeUndefined();
  });

  it("still populates plan on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/vendor.test.ts`
Expected: FAIL — `needsSetup` is `undefined` on the current two-bucket return shape (destructuring still works since TS objects are structural, but `needsSetup` doesn't exist yet on the returned value).

- [ ] **Step 3: Update the implementation**

Replace lines 51-74 of `merqo/src/lib/vendor.ts`:

```ts
/** Map a vendor's link rows onto display tiles via the static KITS config.
 *  KITS is the display allow-list — an unknown slug is dropped, not rendered. */
export function tilesForLinks(
  links: {
    product_slug: string;
    status: GrantStatus;
    plan?: string | null;
  }[],
): { active: KitTile[]; pending: KitTile[]; needsSetup: KitTile[] } {
  const bySlug = new Map(KITS.map((k) => [k.slug, k]));
  const active: KitTile[] = [];
  const pending: KitTile[] = [];
  const needsSetup: KitTile[] = [];
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
    if (l.status === "active") active.push(tile);
    else if (l.status === "needs_setup") needsSetup.push(tile);
    else pending.push(tile);
  }
  return { active, pending, needsSetup };
}
```

`hasRenderableActiveKit` (further down the same file) destructures only
`.active` from `tilesForLinks`'s result and needs no change.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/vendor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full existing test suite to confirm no regression**

Run: `pnpm vitest run src/app/dashboard/\(app\)/page.test.tsx`
Expected: PASS (both existing tests still pass — they only assert on
`active`/`pending` tiles that were already exercised, unaffected by the new
bucket existing alongside them).

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor.ts src/lib/vendor.test.ts
git commit -m "feat: add needs_setup bucket to tilesForLinks"
```

---

## Task 7: merqo — thread `needs_setup` through `vendor-sync.ts`

**Files:**
- Modify: `merqo/src/lib/vendor-sync.ts` (the `ProvisionResult` type, `provisionResponseSchema`, `provisionOnce`, and `provisionVendorKits`)
- Create: `merqo/src/lib/vendor-sync.test.ts`

**Interfaces:**
- Consumes: paykit's `POST /api/merqo/vendor-provision` response shape from Task 3 (`{ ok: true, needs_setup: boolean, plan: string | null }`).
- Produces: `ProvisionResult`'s `ok: true` variant gains an optional `needsSetup?: boolean`. `provisionVendorKits` upserts `vendor_links.status` as `"needs_setup"` when a result's `needsSetup` is `true`, `"active"` otherwise (unchanged for qkit/loopkit, whose responses omit the field entirely). Consumed by Task 8 (`ActivateKitsButton`).

- [ ] **Step 1: Write the failing test**

```ts
// merqo/src/lib/vendor-sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, createServiceClientMock, listLiveProductsMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    listLiveProductsMock: vi.fn(),
  }),
);
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/products", () => ({
  listLiveProducts: listLiveProductsMock,
}));

import { provisionVendorKits } from "./vendor-sync";

const USER = { id: "u1", email: "vendor@business.sg" };

function upsertCapturingClient() {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  fromMock.mockImplementation((table: string) => {
    if (table !== "vendor_links") throw new Error(`unexpected table: ${table}`);
    return {
      upsert: upsertMock,
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    };
  });
  return { upsertMock };
}

describe("provisionVendorKits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceClientMock.mockResolvedValue({ from: fromMock });
  });

  it("upserts status needs_setup when a kit reports needs_setup: true", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      { slug: "paykit", app_url: "https://paykit.test", provision_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        already_existed: false,
        plan: null,
        needs_setup: true,
      }),
    });

    await provisionVendorKits(USER, ["paykit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ product_slug: "paykit", status: "needs_setup" })],
      { onConflict: "email,product_slug" },
    );
  });

  it("upserts status active when a kit's response omits needs_setup (qkit/loopkit shape)", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      { slug: "qkit", app_url: "https://qkit.test", provision_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, already_existed: false, plan: "free" }),
    });

    await provisionVendorKits(USER, ["qkit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ product_slug: "qkit", status: "active" })],
      { onConflict: "email,product_slug" },
    );
  });

  it("upserts status active when a kit explicitly reports needs_setup: false", async () => {
    const { upsertMock } = upsertCapturingClient();
    listLiveProductsMock.mockResolvedValue([
      { slug: "paykit", app_url: "https://paykit.test", provision_secret: "s1" },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        already_existed: false,
        plan: "free",
        needs_setup: false,
      }),
    });

    await provisionVendorKits(USER, ["paykit"]);

    expect(upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ product_slug: "paykit", status: "active" })],
      { onConflict: "email,product_slug" },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/vendor-sync.test.ts`
Expected: FAIL — `status` is currently always `"active"`, so the first test's
assertion (`status: "needs_setup"`) fails.

- [ ] **Step 3: Update the implementation**

In `merqo/src/lib/vendor-sync.ts`, change the `ProvisionResult` type (around
line 143):

```ts
export type ProvisionResult =
  | {
      ok: true;
      slug: string;
      alreadyExisted: boolean;
      plan: string | null;
      needsSetup?: boolean;
    }
  | { ok: false; slug: string };
```

Change `provisionResponseSchema` (around line 147):

```ts
const provisionResponseSchema = z.object({
  ok: z.literal(true),
  already_existed: z.boolean(),
  plan: z.string().nullable(),
  needs_setup: z.boolean().optional(),
});
```

In `provisionOnce`, update the success return (around line 192):

```ts
    return {
      ok: true,
      slug: kit.slug,
      alreadyExisted: parsed.data.already_existed,
      plan: parsed.data.plan,
      needsSetup: parsed.data.needs_setup,
    };
```

In `provisionVendorKits`, update the upsert-building block (around lines
264-271):

```ts
    const nowIso = new Date().toISOString();
    const upserts = successes.map((s) => ({
      email: user.email.toLowerCase(),
      product_slug: s.slug,
      status: (s.needsSetup ? "needs_setup" : "active") as
        | "active"
        | "needs_setup",
      last_verified_at: nowIso,
      plan: s.plan,
    }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/vendor-sync.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor-sync.ts src/lib/vendor-sync.test.ts
git commit -m "feat: thread needs_setup through provisionVendorKits"
```

---

## Task 8: merqo — `ActivateKitsButton` needs-setup rendering

**Files:**
- Modify: `merqo/src/components/dashboard/activate-kits-button.tsx`
- Create: `merqo/src/components/dashboard/activate-kits-button.test.tsx`

**Existing pattern:** `merqo/src/app/dashboard/(app)/page.test.tsx` — jsdom, `next/navigation`'s `useRouter` mocked, `@testing-library/react`.

**Interfaces:**
- Consumes: `ProvisionResult.needsSetup` from Task 7; `KITS` from `@/lib/kits` (for the config-page link, same `${kit.href}/...` convention the dashboard pages already use for external links).
- Produces: no new exported interface — this is a leaf UI component. Consumed by Task 9 unchanged (same props).

- [ ] **Step 1: Write the failing test**

```tsx
// merqo/src/components/dashboard/activate-kits-button.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { activateKitsActionMock, toastSuccessMock, refreshMock } = vi.hoisted(
  () => ({
    activateKitsActionMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    refreshMock: vi.fn(),
  }),
);
vi.mock("@/app/actions/activate-kits", () => ({
  activateKitsAction: activateKitsActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

import { ActivateKitsButton } from "./activate-kits-button";

describe("ActivateKitsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a success toast and refreshes when a kit reaches active", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [{ ok: true, slug: "qkit", alreadyExisted: false, plan: "free" }],
    });
    render(<ActivateKitsButton slugs={["qkit"]} label="Add qkit" />);
    fireEvent.click(screen.getByText("Add qkit"));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Activated qkit"),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows a finish-setup link instead of a success toast when a kit needs setup", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [
        {
          ok: true,
          slug: "paykit",
          alreadyExisted: false,
          plan: null,
          needsSetup: true,
        },
      ],
    });
    render(<ActivateKitsButton slugs={["paykit"]} label="Add paykit" />);
    fireEvent.click(screen.getByText("Add paykit"));
    await waitFor(() =>
      expect(screen.getByText("Finish payment setup")).toBeInTheDocument(),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("still shows a retry affordance when a kit fails, without refreshing", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [{ ok: false, slug: "loopkit" }],
    });
    render(<ActivateKitsButton slugs={["loopkit"]} label="Add loopkit" />);
    fireEvent.click(screen.getByText("Add loopkit"));
    await waitFor(() =>
      expect(screen.getByLabelText("Retry loopkit")).toBeInTheDocument(),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/dashboard/activate-kits-button.test.tsx`
Expected: FAIL — the second test can't find "Finish payment setup" text yet.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `merqo/src/components/dashboard/activate-kits-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateKitsAction } from "@/app/actions/activate-kits";
import { Button } from "@/components/ui/button";
import { KITS } from "@/lib/kits";
import type { ProvisionResult } from "@/lib/vendor-sync";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

/** Bulk ("Activate all my kits", multiple slugs) or single-kit ("Add
 *  {kit}", one slug) activation button — same component, driven entirely
 *  by `slugs`, never a hardcoded count. Renders per-kit failure/retry and
 *  per-kit needs-setup affordances rather than one aggregate message — a
 *  partial failure (or a kit that only reached needs_setup) must never
 *  look like a full success or a page-level error. `variant`/`size`
 *  default to the `<Button>` defaults (primary) so the bulk CTA reads as
 *  primary out of the box; call sites that want the smaller secondary
 *  per-kit look (matching `JoinWaitlistButton`) pass `variant="secondary"
 *  size="sm"` explicitly. */
export function ActivateKitsButton({
  slugs,
  label,
  variant,
  size,
}: {
  slugs: string[];
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const router = useRouter();
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
        const byTargetSlug = new Map(res.results.map((r) => [r.slug, r]));
        const allSucceeded = targetSlugs.every(
          (slug) => byTargetSlug.get(slug)?.ok === true,
        );
        if (allSucceeded) {
          const anyNeedsSetup = targetSlugs.some(
            (slug) => byTargetSlug.get(slug)?.needsSetup === true,
          );
          if (!anyNeedsSetup) {
            toast.success(`Activated ${targetSlugs.join(", ")}`);
          }
          router.refresh();
        }
      } else {
        setError(res.error);
      }
    });
  }

  const failed = (results ?? []).filter((r) => !r.ok);
  const needsSetup = (results ?? []).filter(
    (r): r is Extract<ProvisionResult, { ok: true }> =>
      r.ok && r.needsSetup === true,
  );

  return (
    <div>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => activate(slugs)}
        disabled={pending}
      >
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
      {needsSetup.length > 0 && (
        <ul className="mt-2 space-y-1">
          {needsSetup.map((r) => {
            const kit = KITS.find((k) => k.slug === r.slug);
            return (
              <li key={r.slug} className="text-xs text-muted-foreground">
                {kit?.name ?? r.slug} added — payment setup still needed.{" "}
                {kit?.href && (
                  <a
                    href={`${kit.href}/dashboard/config`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline"
                  >
                    Finish payment setup
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/dashboard/activate-kits-button.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/activate-kits-button.tsx src/components/dashboard/activate-kits-button.test.tsx
git commit -m "feat: render needs-setup outcome distinctly in ActivateKitsButton"
```

---

## Task 9: merqo — dashboard pages render the `needsSetup` bucket

**Files:**
- Modify: `merqo/src/app/dashboard/(app)/page.tsx`
- Modify: `merqo/src/app/dashboard/(app)/page.test.tsx` (extend)
- Modify: `merqo/src/app/dashboard/pending/page.tsx`

**Existing pattern:** the current "Requested" (waitlist) section in
`(app)/page.tsx` and the "You're on the list" copy in `pending/page.tsx`.

**Interfaces:**
- Consumes: `tilesForLinks`'s `needsSetup` array from Task 6.
- Produces: nothing new for other tasks to consume — this is the final
  rendering layer.

- [ ] **Step 1: Write the failing test for `(app)/page.tsx`**

Add this test to the existing `describe("DashboardPage", ...)` block in
`merqo/src/app/dashboard/(app)/page.test.tsx` (alongside the two tests
already there):

```tsx
  it("shows a Finish setup section for a needs_setup kit", async () => {
    requireActiveVendorMock.mockResolvedValue({
      user: { email: "vendor@business.sg" },
      isTeam: false,
      links: [
        { product_slug: "qkit", status: "active", plan: "free" },
        { product_slug: "paykit", status: "needs_setup", plan: null },
      ],
    });
    syncVendorKitsMock.mockResolvedValue([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);

    const { default: DashboardPage } = await import("./page");
    render(await DashboardPage());

    expect(screen.getByText("Finish setup")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Finish setup" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/config"),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/dashboard/(app)/page.test.tsx"`
Expected: FAIL — no "Finish setup" text exists on the page yet.

- [ ] **Step 3: Update `(app)/page.tsx`**

Change the destructuring on line 29:

```tsx
  const { active, pending, needsSetup } = tilesForLinks(links);
```

Insert a new section immediately after the existing `{pending.length > 0 && (...)}`
block (which ends at line 97) and before the `<section className="mt-10">`
"Explore more kits" section (which starts at line 99):

```tsx
      {needsSetup.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Finish setup
          </h2>
          <ul className="mt-3 space-y-2">
            {needsSetup.map((t) => (
              <li
                key={t.slug}
                className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">
                  — one step left to activate.
                </span>
                {t.href && (
                  <a
                    href={`${t.href}/dashboard/config`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-medium text-foreground hover:underline"
                  >
                    Finish setup
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run "src/app/dashboard/(app)/page.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Update `pending/page.tsx`**

This page has no existing test file (confirmed — only `(app)/page.tsx` has
one today); this step's verification is the manual smoke check in Step 6,
consistent with this page's existing lack of automated coverage — adding a
full test harness for a page that has never had one is out of scope for
this task.

Change line 38 from:

```tsx
  const { pending } = tilesForLinks(links);
```

to:

```tsx
  const { pending, needsSetup } = tilesForLinks(links);
```

Replace the conditional block that currently starts at line 69
(`{pending.length > 0 ? (`) and ends at line 102 (the closing `)}` before
the `{addable.length > 0 && (` block) with:

```tsx
          {pending.length > 0 || needsSetup.length > 0 ? (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                {pending.length > 0 ? "You're on the list" : "Almost there"}
              </h1>
              {pending.length > 0 && (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    We&rsquo;ll email{" "}
                    <span className="font-medium text-foreground">
                      {user.email}
                    </span>{" "}
                    when {pending.length === 1 ? "it opens" : "these open"}:
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {pending.map((t) => (
                      <li key={t.slug} className="font-medium">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {needsSetup.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {needsSetup.map((t) => (
                    <li key={t.slug} className="font-medium">
                      {t.name} — one step left.{" "}
                      {t.href && (
                        <a
                          href={`${t.href}/dashboard/config`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-normal underline"
                        >
                          Finish setup
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                No kits yet
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                You&rsquo;re signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
                , but no kits are active on this account yet.
              </p>
            </>
          )}
```

- [ ] **Step 6: Manual smoke check**

Run `pnpm dev`, sign in as a vendor whose only `vendor_links` row is
`status: 'needs_setup'` for `paykit` (insert this row directly via the
Supabase SQL editor against your local instance — there is no UI path to
create this state yet since paykit's provision route doesn't exist in
production until Tasks 1-3 ship), and visit `/dashboard/pending`. Confirm
the page shows "Almost there" and a "Finish setup" link instead of "No kits
yet".

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `pnpm test && pnpm tsc --noEmit`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add "src/app/dashboard/(app)/page.tsx" "src/app/dashboard/(app)/page.test.tsx" src/app/dashboard/pending/page.tsx
git commit -m "feat: render needs_setup kits on both dashboard pages"
```
