# Merqo Self-Serve Upgrade Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vendor on Merqo's `/dashboard` can click "Upgrade to Pro" on their free-tier qkit tile and have the request land directly in qkit's own admin queue — without leaving Merqo.

**Architecture:** A new `src/lib/upgrade-request.ts` (`requestKitUpgrade`, mirrors `checkVendorStatus`'s never-throw HTTP-call shape exactly) is called by a new Server Action (`src/app/actions/upgrade.ts`), gated by a new pure authorization check in `vendor.ts` (`hasActiveLinkFor`). A new client component (`upgrade-button.tsx`) replaces the plain link in `VendorKitCard`. This plan assumes qkit's `/api/merqo/upgrade-request` endpoint exists (separate repo/plan) — `requestKitUpgrade` degrades gracefully if it doesn't, so this plan is independently testable via mocks even if run before that endpoint lands.

**Tech Stack:** Next.js 16 Server Action + Client Component, Zod-free (no new user input boundary beyond what's already validated), Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- No cross-domain session handoff — the Server Action calls qkit's HTTP endpoint server-to-server; the vendor never leaves Merqo or re-authenticates elsewhere.
- No new secret — reuses `MERQO_METRICS_SECRET` via the existing `metrics_secret` column already read from `merqo.products`.
- A vendor may only request an upgrade for a kit they hold an _active_ `vendor_links` row for — enforced independently of the UI, inside the Server Action itself.
- No toast — Merqo has no `Toaster` mounted; feedback is inline text, matching the existing waitlist form's convention.
- `requestKitUpgrade` must never throw, mirroring `checkVendorStatus`'s contract.

---

### Task 1: `hasActiveLinkFor` in `vendor.ts`

**Files:**

- Modify: `src/lib/vendor.ts`
- Modify: `test/lib/vendor.test.ts`

**Interfaces:**

- Consumes: `GrantStatus` type (existing, from `@/lib/admin`).
- Produces: `hasActiveLinkFor(links: {product_slug: string; status: GrantStatus}[], slug: string): boolean` — consumed by Task 3's Server Action.

- [ ] **Step 1: Write the failing tests**

Append to `test/lib/vendor.test.ts`:

```typescript
describe("hasActiveLinkFor", () => {
  it("is true for a matching active link", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "qkit", status: "active" }], "qkit"),
    ).toBe(true);
  });

  it("is false for a waitlist link to the same slug", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "qkit", status: "waitlist" }], "qkit"),
    ).toBe(false);
  });

  it("is false when there's no link at all", () => {
    expect(hasActiveLinkFor([], "qkit")).toBe(false);
  });

  it("is false for an active link to a different slug", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "loopkit", status: "active" }], "qkit"),
    ).toBe(false);
  });
});
```

Add `hasActiveLinkFor` to the existing import line at the top of the test file (alongside `resolveHome`, `tilesForLinks`, etc.).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: FAIL — `hasActiveLinkFor` is not exported

- [ ] **Step 3: Write the implementation**

Append to `src/lib/vendor.ts`:

```typescript
/** True when the vendor has an active link to this specific kit slug — the
 *  one-slug version of hasRenderableActiveKit, used to gate the self-serve
 *  upgrade-request action so it can't be invoked for a kit the vendor
 *  doesn't actually use. Pure — tested. */
export function hasActiveLinkFor(
  links: { product_slug: string; status: GrantStatus }[],
  slug: string,
): boolean {
  return links.some((l) => l.product_slug === slug && l.status === "active");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: PASS (17 tests total — 13 existing plus the 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts
git commit -m "feat: add hasActiveLinkFor to gate self-serve upgrade requests"
```

---

### Task 2: `requestKitUpgrade` — one kit's HTTP call

**Files:**

- Create: `src/lib/upgrade-request.ts`
- Test: `test/lib/upgrade-request.test.ts`

**Interfaces:**

- Consumes: `RegistryRow` type from `@/lib/products` (existing).
- Produces: `type UpgradeRequestResult = {success: true} | {success: false; error: string}`; `requestKitUpgrade(kit, email, opts?): Promise<UpgradeRequestResult>` — consumed by Task 3's Server Action.

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/upgrade-request.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { requestKitUpgrade } from "@/lib/upgrade-request";

const kit = {
  app_url: "https://qkit-sg.vercel.app",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("requestKitUpgrade", () => {
  it("posts to the kit's upgrade-request endpoint with the bearer and email", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const r = await requestKitUpgrade(kit, "a@x.com");
    expect(r).toEqual({ success: true });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit-sg.vercel.app/api/merqo/upgrade-request",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s",
    );
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@x.com" });
  });

  it("returns success:false on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    const r = await requestKitUpgrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false on a 404 (no matching vendor)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "No matching vendor" }),
        {
          status: 404,
        },
      ),
    );
    const r = await requestKitUpgrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await requestKitUpgrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the 200 body isn't valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await requestKitUpgrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the kit has no app_url or metrics_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await requestKitUpgrade(
      { app_url: null, metrics_secret: null },
      "a@x.com",
    );
    expect(r.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/upgrade-request.test.ts`
Expected: FAIL — `Cannot find module '@/lib/upgrade-request'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/upgrade-request.ts
import type { RegistryRow } from "@/lib/products";

type UpgradeRequestSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type UpgradeRequestResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** Ask one kit to file a monthly-Pro upgrade request for this email. Never
 *  throws — mirrors checkVendorStatus's never-throw error handling so a kit
 *  being down degrades to a vendor-facing error message, not a crash. */
export async function requestKitUpgrade(
  kit: UpgradeRequestSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<UpgradeRequestResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { success: false, error: GENERIC_ERROR };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/upgrade-request", kit.app_url);
  } catch {
    return { success: false, error: GENERIC_ERROR };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.metrics_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { success: false, error: GENERIC_ERROR };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { success: false, error: GENERIC_ERROR };
    }
    if (
      typeof json === "object" &&
      json !== null &&
      (json as { success?: unknown }).success === true
    ) {
      return { success: true };
    }
    return { success: false, error: GENERIC_ERROR };
  } catch {
    return { success: false, error: GENERIC_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/upgrade-request.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/upgrade-request.ts test/lib/upgrade-request.test.ts
git commit -m "feat: add requestKitUpgrade for the self-serve upgrade action"
```

---

### Task 3: `requestUpgrade` Server Action

**Files:**

- Create: `src/app/actions/upgrade.ts`

**Interfaces:**

- Consumes: `loadVendorContext`, `hasActiveLinkFor` from `@/lib/vendor` (Task 1 + existing); `listLiveProducts` from `@/lib/products` (existing); `requestKitUpgrade` from `@/lib/upgrade-request` (Task 2).
- Produces: `requestUpgrade(slug: string): Promise<{success: true} | {success: false; error: string}>` — consumed by Task 4's `UpgradeButton`.

- [ ] **Step 1: Write the Server Action (DB-touching glue — no dedicated unit test, matching this repo's established convention for functions like `syncVendorKits`/`admin.ts`'s `grantKit`, which are also untested directly; the authorization logic it calls, `hasActiveLinkFor`, is unit-tested in Task 1)**

```typescript
// src/app/actions/upgrade.ts
"use server";

import { loadVendorContext, hasActiveLinkFor } from "@/lib/vendor";
import { listLiveProducts } from "@/lib/products";
import { requestKitUpgrade } from "@/lib/upgrade-request";

export type UpgradeActionResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** File a monthly-Pro upgrade request for `slug` on the signed-in vendor's
 *  behalf. Independently re-checks that the vendor actually holds an active
 *  link to that kit — the UI only ever renders this action's button for a
 *  kit the vendor uses, but a direct invocation must not bypass that. */
export async function requestUpgrade(
  slug: string,
): Promise<UpgradeActionResult> {
  const { user, links } = await loadVendorContext();
  if (!user?.email) {
    return { success: false, error: "Please sign in first." };
  }
  if (!hasActiveLinkFor(links, slug)) {
    return { success: false, error: GENERIC_ERROR };
  }

  const products = await listLiveProducts();
  const kit = products.find((p) => p.slug === slug);
  if (!kit) {
    return { success: false, error: GENERIC_ERROR };
  }

  return requestKitUpgrade(kit, user.email);
}
```

- [ ] **Step 2: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: full suite green (this task adds no new test file)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/upgrade.ts
git commit -m "feat: add requestUpgrade server action"
```

---

### Task 4: `UpgradeButton` + wire into `VendorKitCard`

**Files:**

- Create: `src/app/dashboard/(app)/upgrade-button.tsx`
- Modify: `src/app/dashboard/(app)/vendor-kit-card.tsx`

**Interfaces:**

- Consumes: `requestUpgrade` from `@/app/actions/upgrade` (Task 3); `KitTile` type (existing, `@/lib/vendor`).
- Produces: no new exports beyond the component itself — consumed only by `vendor-kit-card.tsx` in this same task.

- [ ] **Step 1: Write the button component**

```typescript
// src/app/dashboard/(app)/upgrade-button.tsx
"use client";

import { useState, useTransition } from "react";
import { requestUpgrade } from "@/app/actions/upgrade";

/** Replaces the plain "Upgrade to Pro" link on a free-tier kit tile with a
 *  real action: files a monthly-Pro upgrade request without leaving Merqo.
 *  No toast (Merqo has none mounted) — inline text feedback, matching the
 *  existing waitlist form's convention. */
export function UpgradeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      const res = await requestUpgrade(slug);
      if (res.success) {
        setState("sent");
      } else {
        setState("error");
        setError(res.error);
      }
    });
  }

  if (state === "sent") {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Request sent — we&apos;ll set you up shortly.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm font-medium text-foreground hover:underline disabled:opacity-60"
      >
        {pending ? "Sending…" : "Upgrade to Pro"}
      </button>
      {state === "error" && error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the kit card**

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
            <a href={`${tile.href}/dashboard`} target="_blank" rel="noreferrer">
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

Replace with:

```typescript
import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "./upgrade-button";

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
            <a href={`${tile.href}/dashboard`} target="_blank" rel="noreferrer">
              Open {tile.name}
            </a>
          </Button>
        )}
        {tile.plan === "free" && <UpgradeButton slug={tile.slug} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual browser verification (no existing test for either file — matches their pre-existing untested state; AGENTS.md requires exercising UI changes in a real browser before claiming done)**

Run: `pnpm dev`, sign in as a vendor with an active, free-tier `qkit` link:

- Confirm the "Upgrade to Pro" button renders in place of the old link.
- Click it; confirm it shows "Sending…" briefly, then "Request sent — we'll set you up shortly." in place of the button.
- In Supabase, confirm a new `pending`/`monthly` row now exists in qkit's `purchase_requests` table for that vendor (requires qkit's `/api/merqo/upgrade-request` endpoint to already be deployed — if it isn't yet, expect the error state instead: a small red "Could not send your request..." line under the button, and confirm the button remains clickable for a retry).
- Confirm a vendor with `plan = "pro"` sees no upgrade button at all (unchanged from before this task).

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: full suite green

- [ ] **Step 5: Commit**

```bash
git add "src/app/dashboard/(app)/upgrade-button.tsx" "src/app/dashboard/(app)/vendor-kit-card.tsx"
git commit -m "feat: wire self-serve upgrade requests into the vendor dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** `hasActiveLinkFor` authorization gate (Task 1), `requestKitUpgrade` HTTP call + never-throw contract (Task 2), `requestUpgrade` Server Action wiring the two together with independent re-authorization (Task 3), `UpgradeButton` UI + `VendorKitCard` wiring (Task 4) — every "Changes" bullet in the design spec maps to a task. All spec "Non-goals" are respected: no loopkit changes anywhere in this plan, no toast (inline text only), no new secret (`metrics_secret` reused from the existing registry read), no persistent pending-state tracking across page loads.
- **No placeholders** — every step has complete, runnable code.
- **Type consistency** — `UpgradeRequestResult` (Task 2) is exactly the return type `requestUpgrade` (Task 3) passes through unchanged; `UpgradeActionResult` (Task 3) is the exact type `UpgradeButton` (Task 4) destructures (`res.success`/`res.error`) with no adaptation.
