# Self-Serve Downgrade to Free from Merqo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a vendor on Merqo's `/dashboard` a "Cancel Pro" action on their Pro-tier kit tile that instantly flips them back to Free, no admin confirmation — mirroring the existing upgrade-request feature's shape in reverse.

**Architecture:** `requestKitDowngrade` (new `src/lib/downgrade-request.ts`) POSTs to the kit's new `/api/merqo/downgrade-request` endpoint (built in the sibling qkit plan), mirroring `requestKitUpgrade`'s never-throw shape exactly. A new server action, `requestDowngrade` (`src/app/actions/downgrade.ts`), re-checks the vendor's active link before calling it, mirroring `requestUpgrade`. A new client component, `DowngradeButton`, wraps the action behind a confirmation dialog (the one place a vendor is protected from a stray click, since the backend has no confirmation gate) and wires into `VendorKitCard` next to the existing Pro badge.

**Tech Stack:** Next.js 16 Server Actions, React `useTransition`, shadcn `AlertDialog` (already installed), Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Validate all user input with Zod `safeParse()` at every boundary (AGENTS.md) — N/A here (no new user-input boundary; `slug` is server-action-internal and re-validated against `hasActiveLinkFor`/`listLiveProducts`, matching `requestUpgrade`'s own pattern).
- Reuse the existing `MERQO_METRICS_SECRET`-backed `metrics_secret` field already on each kit's registry row — no new secret.
- `requestKitDowngrade` must never throw (mirrors `checkVendorStatus`/`requestKitUpgrade`'s defensive shape).
- `requestDowngrade` must wrap its entire body in try/catch, converting any unexpected throw into the same generic error message it returns on other failure paths (matches the fix already applied to `requestUpgrade`).
- No toast — Merqo has none mounted; use inline text feedback, matching `UpgradeButton`'s convention.
- The confirmation dialog uses the existing `AlertDialog` primitive (`src/components/ui/alert-dialog.tsx`) — do not build a custom modal.

---

### Task 1: `requestKitDowngrade` — HTTP client + tests

**Files:**

- Create: `src/lib/downgrade-request.ts`
- Test: `test/lib/downgrade-request.test.ts`

**Interfaces:**

- Consumes: `RegistryRow` from `@/lib/products` (existing type, `Pick<RegistryRow, "app_url" | "metrics_secret">`).
- Produces: `type DowngradeRequestResult = { success: true } | { success: false; error: string }`; `requestKitDowngrade(kit: Pick<RegistryRow, "app_url"|"metrics_secret">, email: string, opts?: { timeoutMs?: number }): Promise<DowngradeRequestResult>` — consumed by Task 2's server action.

- [ ] **Step 1: Write the failing tests**

```typescript
// test/lib/downgrade-request.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { requestKitDowngrade } from "@/lib/downgrade-request";

const kit = {
  app_url: "https://qkit-sg.vercel.app",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("requestKitDowngrade", () => {
  it("posts to the kit's downgrade-request endpoint with the bearer and email", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r).toEqual({ success: true });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit-sg.vercel.app/api/merqo/downgrade-request",
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
    const r = await requestKitDowngrade(kit, "a@x.com");
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
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the 200 body isn't valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the kit has no app_url or metrics_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await requestKitDowngrade(
      { app_url: null, metrics_secret: null },
      "a@x.com",
    );
    expect(r.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/lib/downgrade-request.test.ts`
Expected: FAIL — `Cannot find module '@/lib/downgrade-request'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/downgrade-request.ts
import type { RegistryRow } from "@/lib/products";

type DowngradeRequestSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type DowngradeRequestResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** Ask one kit to instantly flip this email back to free. Never throws —
 *  mirrors requestKitUpgrade's/checkVendorStatus's never-throw error
 *  handling so a kit being down degrades to a vendor-facing error message,
 *  not a crash. */
export async function requestKitDowngrade(
  kit: DowngradeRequestSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<DowngradeRequestResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { success: false, error: GENERIC_ERROR };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/downgrade-request", kit.app_url);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/lib/downgrade-request.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/downgrade-request.ts test/lib/downgrade-request.test.ts
git commit -m "feat: add requestKitDowngrade HTTP client"
```

---

### Task 2: `requestDowngrade` server action

**Files:**

- Create: `src/app/actions/downgrade.ts`

**Interfaces:**

- Consumes: `loadVendorContext`, `hasActiveLinkFor` from `@/lib/vendor` (existing); `listLiveProducts` from `@/lib/products` (existing); `requestKitDowngrade` from Task 1 (`@/lib/downgrade-request`).
- Produces: `type DowngradeActionResult = { success: true } | { success: false; error: string }`; `requestDowngrade(slug: string): Promise<DowngradeActionResult>` — consumed by Task 3's `DowngradeButton`.

- [ ] **Step 1: Write the server action**

```typescript
// src/app/actions/downgrade.ts
"use server";

import { loadVendorContext, hasActiveLinkFor } from "@/lib/vendor";
import { listLiveProducts } from "@/lib/products";
import { requestKitDowngrade } from "@/lib/downgrade-request";

export type DowngradeActionResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** Flip `slug` back to free for the signed-in vendor. Independently
 *  re-checks that the vendor actually holds an active link to that kit —
 *  the UI only ever renders this action's button for a kit the vendor
 *  uses, but a direct invocation must not bypass that. */
export async function requestDowngrade(
  slug: string,
): Promise<DowngradeActionResult> {
  try {
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

    return requestKitDowngrade(kit, user.email);
  } catch (err) {
    console.error("requestDowngrade: unexpected failure", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
```

- [ ] **Step 2: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: all tests pass (no dedicated test for this action — DB-touching glue, matching the `requestUpgrade`/`syncVendorKits` convention; the pure `hasActiveLinkFor` check it reuses is already tested in `test/lib/vendor.test.ts`)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/downgrade.ts
git commit -m "feat: add requestDowngrade server action"
```

---

### Task 3: `DowngradeButton` + wire into `VendorKitCard`

**Files:**

- Create: `src/app/dashboard/(app)/downgrade-button.tsx`
- Modify: `src/app/dashboard/(app)/vendor-kit-card.tsx`

**Interfaces:**

- Consumes: `requestDowngrade` from Task 2 (`@/app/actions/downgrade`); `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger` from `@/components/ui/alert-dialog` (existing, already installed).
- Produces: `DowngradeButton({ slug }: { slug: string })` — rendered by `VendorKitCard` for `tile.plan === "pro"` tiles.

- [ ] **Step 1: Write `DowngradeButton`**

```tsx
// src/app/dashboard/(app)/downgrade-button.tsx
"use client";

import { useState, useTransition } from "react";
import { requestDowngrade } from "@/app/actions/downgrade";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Replaces the Pro-tier kit tile with a "Cancel Pro" action: flips the
 *  vendor back to free instantly, no admin confirmation. The backend has no
 *  confirmation gate of its own, so this dialog is the one place a vendor
 *  is protected from a stray click. No toast (Merqo has none mounted) —
 *  inline text feedback, matching UpgradeButton's convention. */
export function DowngradeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    startTransition(async () => {
      const res = await requestDowngrade(slug);
      if (res.success) {
        setState("done");
      } else {
        setState("error");
        setError(res.error);
      }
    });
  }

  if (state === "done") {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Cancelled — you&apos;re back on Free.
      </p>
    );
  }

  return (
    <div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className="text-sm font-medium text-foreground hover:underline disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel Pro"}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be moved back to the free tier immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state === "error" && error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `VendorKitCard`**

In `src/app/dashboard/(app)/vendor-kit-card.tsx`, add the import and render the new button next to the existing `UpgradeButton` line:

```tsx
import { DowngradeButton } from "./downgrade-button";
```

```tsx
{
  tile.plan === "free" && <UpgradeButton slug={tile.slug} />;
}
{
  tile.plan === "pro" && <DowngradeButton slug={tile.slug} />;
}
```

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`, sign in as a vendor with an active Pro-tier kit link, open `/dashboard`.

Expected: the Pro-tier tile shows a "Cancel Pro" link next to the Pro badge. Clicking it opens a confirmation dialog ("Cancel your Pro subscription?" / "You'll be moved back to the free tier immediately."). Clicking "Never mind" closes the dialog with no action taken. Clicking "Cancel subscription" shows "Cancelling…" briefly, then replaces the row with "Cancelled — you're back on Free." A free-tier tile shows the existing "Upgrade to Pro" button, not this one.

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: all tests pass (no test for `DowngradeButton`/`VendorKitCard` — matches these files' pre-existing untested state, per AGENTS.md's manual-verification requirement for UI)

- [ ] **Step 5: Commit**

```bash
git add "src/app/dashboard/(app)/downgrade-button.tsx" "src/app/dashboard/(app)/vendor-kit-card.tsx"
git commit -m "feat: wire self-serve Pro cancellation into the vendor dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** Merqo section of the design spec (`requestKitDowngrade` never-throw HTTP client, `requestDowngrade` server action with active-link re-check and try/catch, `DowngradeButton` confirmation-gated UI, wiring into `VendorKitCard` for `plan === "pro"` tiles) — covered by Tasks 1–3.
- **No placeholders** — every step has complete, runnable code.
- **Type consistency** — `DowngradeRequestResult` (Task 1) flows unchanged into `DowngradeActionResult` (Task 2, same shape, re-exported under a task-scoped name matching the existing `UpgradeActionResult` precedent) and into `DowngradeButton`'s `res.success`/`res.error` handling (Task 3) without adaptation.
- **Dependency note for the implementer:** Task 2 and Task 3 assume the sibling qkit plan (`docs/superpowers/plans/2026-07-10-qkit-downgrade-request-endpoint.md`, in the qkit repo) has shipped `/api/merqo/downgrade-request` — Task 1's client can be built and tested (mocked `fetch`) independently, but end-to-end manual verification in Task 3 requires that endpoint to exist.
