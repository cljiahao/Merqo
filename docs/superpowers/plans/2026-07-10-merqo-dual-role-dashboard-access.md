# Dual-Role Dashboard Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an account that is both a Merqo-team member and an active vendor reach both `/admin` and `/dashboard`, with a one-click switch link in the account menu — without changing behavior for single-role accounts or post-login routing.

**Architecture:** A new pure function, `dashboardGateDestination`, replaces `resolveHome` as the decision `requireActiveVendor` uses to block/allow `/dashboard` — it only blocks on the absence of an active kit, not on team membership alone. A new lightweight, best-effort helper, `hasActiveVendorAccess`, lets the admin layout know whether to show the switch link, without adding cost to the many other pages that already call `requireMerqoTeam`. `AccountMenu` gains an optional `switchTo` prop consumed by both layouts.

**Tech Stack:** Next.js 16 Server Components, Supabase (`@supabase/ssr`), Vitest, React Testing Library.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- `resolveHome` and `src/app/post-login/route.ts` are untouched — post-login routing behavior does not change.
- `requireMerqoTeam()`'s signature and query cost are untouched — the new vendor-access check lives only in `admin/layout.tsx`, not in the shared gate function.
- `hasActiveVendorAccess` degrades to `false` on a read error (hides the link) rather than throwing — it is a convenience affordance, not an access gate.
- The switch link only ever appears for accounts holding both roles — a pure vendor or pure team member sees no new UI.
- Authorization for `/dashboard` access itself continues to be enforced by `requireActiveVendor`'s redirect, not by the presence/absence of the switch link.

---

### Task 1: `dashboardGateDestination` + `requireActiveVendor` + `hasActiveVendorAccess`

**Files:**

- Modify: `src/lib/vendor.ts`
- Modify: `test/lib/vendor.test.ts`

**Interfaces:**

- Consumes: `HomeDestination`, `hasRenderableActiveKit`, `loadVendorContext`, `VendorLink`, `createServerClient` — all already in this file/imported.
- Produces: `dashboardGateDestination(isTeam: boolean, hasActiveKit: boolean): HomeDestination`; `requireActiveVendor(): Promise<{ user: User; links: VendorLink[]; isTeam: boolean }>` (return shape gains `isTeam`); `hasActiveVendorAccess(): Promise<boolean>`. Consumed by Task 3 (`admin/layout.tsx`, `dashboard/(app)/layout.tsx`).

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `test/lib/vendor.test.ts`, right after the existing `describe("resolveHome", ...)` block:

```typescript
describe("dashboardGateDestination", () => {
  it("allows /dashboard for a dual-role account (team + active kit)", () => {
    expect(dashboardGateDestination(true, true)).toBe("/dashboard");
  });
  it("allows /dashboard for a plain active vendor", () => {
    expect(dashboardGateDestination(false, true)).toBe("/dashboard");
  });
  it("blocks to /admin for a team member with no active kit", () => {
    expect(dashboardGateDestination(true, false)).toBe("/admin");
  });
  it("blocks to /dashboard/pending for a non-team user with no active kit", () => {
    expect(dashboardGateDestination(false, false)).toBe("/dashboard/pending");
  });
});
```

Add `dashboardGateDestination` to the existing import from `@/lib/vendor` at the top of the file:

```typescript
import {
  resolveHome,
  dashboardGateDestination,
  tilesForLinks,
  hasRenderableActiveKit,
  addableKits,
  hasActiveLinkFor,
} from "@/lib/vendor";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: FAIL — `dashboardGateDestination is not exported` (or `is not a function`)

- [ ] **Step 3: Write minimal implementation**

In `src/lib/vendor.ts`, add the new pure function right after `resolveHome`:

```typescript
/** Where `requireActiveVendor` redirects AWAY to when the signed-in user
 *  has no active kit. Unlike resolveHome (which always sends a team member
 *  to /admin as the post-login default), this only blocks /dashboard for
 *  the absence of an active kit — a dual-role account (team + active kit)
 *  is never blocked here, even though resolveHome would still land them on
 *  /admin fresh from login. */
export function dashboardGateDestination(
  isTeam: boolean,
  hasActiveKit: boolean,
): HomeDestination {
  if (hasActiveKit) return "/dashboard";
  return isTeam ? "/admin" : "/dashboard/pending";
}
```

Then replace the existing `requireActiveVendor` function (near the bottom of the file) with:

```typescript
/** Gate a /dashboard page on active-vendor access. Also returns isTeam so
 *  callers (the dashboard layout) can offer a switch link to /admin for
 *  dual-role accounts. */
export async function requireActiveVendor(): Promise<{
  user: User;
  links: VendorLink[];
  isTeam: boolean;
}> {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  const dest = dashboardGateDestination(isTeam, hasRenderableActiveKit(links));
  if (dest !== "/dashboard") redirect(dest);
  return { user, links, isTeam };
}
```

Then add this new function after `requireActiveVendor`, at the end of the file:

```typescript
/** Whether the signed-in user also has any active vendor kit — used only
 *  by the admin layout to decide whether to show a "view vendor dashboard"
 *  switch link. Best-effort: a read error hides the link rather than
 *  breaking the whole /admin page over a decorative affordance, unlike
 *  loadVendorContext's own links read, which throws loudly because it
 *  gates real access. RLS scopes vendor_links to the caller's own rows,
 *  same as loadVendorContext's own (also unfiltered) query. */
export async function hasActiveVendorAccess(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("vendor_links")
    .select("product_slug, status");
  if (error) return false;
  return hasRenderableActiveKit((data ?? []) as VendorLink[]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: PASS (all existing tests + 4 new `dashboardGateDestination` tests)

- [ ] **Step 5: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean — `requireActiveVendor`'s new return shape (`isTeam` added) has no other callers in the repo yet (Task 3 adds the one real caller), so this must not break any existing build.

Run: `pnpm vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts
git commit -m "feat: allow dual-role accounts to reach /dashboard"
```

---

### Task 2: `AccountMenu` — optional switch-link

**Files:**

- Modify: `src/components/account-menu.tsx`
- Modify: `test/components/account-menu.test.tsx`

**Interfaces:**

- Consumes: nothing new — `switchTo` is a plain `{href, label}` object passed in by the caller.
- Produces: `AccountMenu` gains an optional `switchTo?: { href: string; label: string }` prop. Consumed by Task 3 (`admin/layout.tsx`, `dashboard/(app)/layout.tsx`).

- [ ] **Step 1: Write the failing tests**

Add these two tests to the existing `describe("AccountMenu", ...)` block in `test/components/account-menu.test.tsx`, after the two existing tests:

```typescript
  it("shows the switch link when switchTo is provided", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        switchTo={{ href: "/admin", label: "Go to admin" }}
      />,
    );
    const link = screen.getByRole("link", { name: "Go to admin" });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("shows no switch link when switchTo is absent", () => {
    render(<AccountMenu email="vendor@example.com" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
```

Note: the dropdown menu's content is only mounted in the DOM once the trigger opens in a real browser, but Radix's `DropdownMenuContent` in this codebase's test environment renders its children immediately in these existing tests (confirmed by the existing two `AccountMenu` tests already querying trigger content without simulating a click) — so no additional `userEvent.click` setup is needed here; follow the same pattern as the existing tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: FAIL — no `switchTo` prop exists yet, so the link is never rendered; `getByRole("link", ...)` throws

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/components/account-menu.tsx` with:

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/auth";

/** Single-letter avatar fallback derived from an email's first character —
 *  Merqo has no stored display name (vendors and team members are identified
 *  by email/user_id only) to draw real initials from. */
export function initials(email: string | null | undefined): string {
  const first = email?.trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}

/** Shared account-menu trigger for /dashboard and /admin headers — an
 *  initials avatar that opens a dropdown with the signed-in email, an
 *  optional switch link for dual-role accounts, and Sign out. Matches
 *  qkit's DashboardNav account-area shape; scoped to just account info +
 *  navigation since Merqo has no Profile/Settings/Help pages. */
export function AccountMenu({
  email,
  switchTo,
}: {
  email?: string | null;
  switchTo?: { href: string; label: string };
}) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25 ring-inset"
          >
            {initials(email)}
          </span>
          {email && (
            <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
              {email}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {switchTo && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={switchTo.href}>{switchTo.label}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onSelect={() => startTransition(() => signOutAction())}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: PASS (6 tests: 4 existing + 2 new)

- [ ] **Step 5: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/account-menu.tsx test/components/account-menu.test.tsx
git commit -m "feat: add optional switch-area link to AccountMenu"
```

---

### Task 3: Wire the switch link into both layouts

**Files:**

- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/dashboard/(app)/layout.tsx`

**Interfaces:**

- Consumes: `hasActiveVendorAccess`, `requireActiveVendor` (now returning `isTeam`) from Task 1 (`@/lib/vendor`); the extended `AccountMenu` from Task 2 (`@/components/account-menu`).
- Produces: the finished feature. Nothing downstream consumes this task.

- [ ] **Step 1: Update `src/app/admin/layout.tsx`**

Replace:

```tsx
import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";
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
          <AccountMenu email={user.email} />
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
```

with:

```tsx
import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { hasActiveVendorAccess } from "@/lib/vendor";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route once here; child pages re-derive the user cheaply.
  const { user } = await requireMerqoTeam();
  const canSwitch = await hasActiveVendorAccess();

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
          <AccountMenu
            email={user.email}
            switchTo={
              canSwitch
                ? { href: "/dashboard", label: "View vendor dashboard" }
                : undefined
            }
          />
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/dashboard/(app)/layout.tsx`**

Replace:

```tsx
import { requireActiveVendor } from "@/lib/vendor";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every gated /dashboard route once here; the page re-derives links cheaply.
  const { user } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <AccountMenu email={user.email} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
```

with:

```tsx
import { requireActiveVendor } from "@/lib/vendor";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every gated /dashboard route once here; the page re-derives links cheaply.
  const { user, isTeam } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <AccountMenu
            email={user.email}
            switchTo={
              isTeam ? { href: "/admin", label: "Go to admin" } : undefined
            }
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Manual browser verification**

Run: `pnpm dev`.

Expected, for a dual-role account (both a `merqo_team` row and an active `vendor_links` row):

- Signing in still lands on `/admin` (post-login default unchanged).
- The account menu on `/admin` shows a "View vendor dashboard" link above Sign out; clicking it navigates to `/dashboard` and actually renders (no redirect-away).
- The account menu on `/dashboard` shows a "Go to admin" link; clicking it navigates back to `/admin`.
- Navigating directly to `/dashboard` by URL (not via the link) also works now, instead of bouncing to `/admin`.

Expected, for a single-role account (only `merqo_team`, no active vendor kit):

- Account menu on `/admin` shows no switch link.
- Direct navigation to `/dashboard` still redirects to `/admin` (unchanged).

Expected, for a single-role account (only an active vendor kit, not on the team):

- Account menu on `/dashboard` shows no switch link.
- Direct navigation to `/admin` still redirects to `/no-access` (unchanged — `requireMerqoTeam` is untouched).

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

Run: `pnpm vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/layout.tsx" "src/app/dashboard/(app)/layout.tsx"
git commit -m "feat: wire the dual-role switch link into both layouts"
```

---

## Self-Review Notes

- **Spec coverage:** every `## Changes` subsection in the design spec (`src/lib/vendor.ts`'s three exports, `AccountMenu`'s `switchTo` prop, both layout wirings) maps to Tasks 1–3 one-to-one.
- **No placeholders** — every step has complete, runnable code.
- **Type consistency** — `HomeDestination` (existing) is the return type of both `resolveHome` (unchanged) and the new `dashboardGateDestination` (Task 1); `requireActiveVendor`'s new `isTeam` field (Task 1) flows unchanged into `dashboard/(app)/layout.tsx`'s destructuring (Task 3); `AccountMenu`'s `switchTo` shape (Task 2) is passed identically from both layouts (Task 3) with no adaptation layer.
- **Regression guard:** Task 1's test suite explicitly re-asserts the three pre-existing single-role cases (`(false,true)→"/dashboard"`, `(true,false)→"/admin"`, `(false,false)→"/dashboard/pending"`) alongside the one new case this feature adds (`(true,true)→"/dashboard"`), so a reviewer can see nothing regressed for the common cases, not just that the new case works.
