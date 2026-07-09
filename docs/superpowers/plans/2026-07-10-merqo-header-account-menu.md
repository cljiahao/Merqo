# Header Account Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated "plain email + Sign out button" pair in Merqo's `/dashboard` and `/admin` headers with one shared avatar-triggered dropdown, matching qkit's account-menu shape.

**Architecture:** One new shadcn primitive (`dropdown-menu`, CLI-installed) backs one new shared component (`AccountMenu`, with a pure exported `initials()` helper), which both layout files import in place of their current duplicated markup.

**Tech Stack:** Next.js 16 Server Component (layouts) + Client Component (`AccountMenu`), shadcn/ui `dropdown-menu`, Vitest.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- `src/components/ui/*` is CLI-managed — never hand-edit `dropdown-menu.tsx` after installing it (AGENTS.md).
- No dead code: both layout files must drop their `signOutAction`/`Button` imports once no longer used (they become dead after this change).
- No new dependency beyond the shadcn primitive — no shadcn `Avatar` component (design spec, "Non-goals": qkit's own avatar is a plain styled `<span>`, not the `Avatar` primitive).
- No Profile/Settings/Help/Feedback menu items — Merqo has no such pages (design spec, "Non-goals").

---

### Task 1: Install the `dropdown-menu` primitive

**Files:**

- Create: `src/components/ui/dropdown-menu.tsx` (via shadcn CLI, not hand-written)

**Interfaces:**

- Consumes: nothing.
- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuItem` (accepts `variant?: "default" | "destructive"`), `DropdownMenuSeparator` — all consumed by Task 2's `AccountMenu`.

- [ ] **Step 1: Install**

Run: `pnpm dlx shadcn@latest add dropdown-menu --yes`
Expected: creates `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 2: Verify it compiles cleanly**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean (no output changes needed — the installed file is already formatted by the CLI)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "feat: add shadcn dropdown-menu primitive"
```

---

### Task 2: `AccountMenu` component + `initials()` test

**Files:**

- Create: `src/components/account-menu.tsx`
- Test: `test/components/account-menu.test.ts`

**Interfaces:**

- Consumes: `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuLabel`/`DropdownMenuItem`/`DropdownMenuSeparator` from `@/components/ui/dropdown-menu` (Task 1); `signOutAction` from `@/app/actions/auth` (existing).
- Produces: `initials(email: string | null | undefined): string` (pure, exported); `AccountMenu({ email }: { email?: string | null })` — consumed by Task 3's two layout files.

- [ ] **Step 1: Write the failing test**

```typescript
// test/components/account-menu.test.ts
import { describe, it, expect } from "vitest";
import { initials } from "@/components/account-menu";

describe("initials", () => {
  it("returns the uppercased first character of an email", () => {
    expect(initials("alice@example.com")).toBe("A");
  });

  it("returns • for null", () => {
    expect(initials(null)).toBe("•");
  });

  it("returns • for undefined", () => {
    expect(initials(undefined)).toBe("•");
  });

  it("returns • for an empty string", () => {
    expect(initials("")).toBe("•");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/account-menu.test.ts`
Expected: FAIL — `Cannot find module '@/components/account-menu'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/account-menu.tsx
"use client";

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
 *  initials avatar that opens a dropdown with the signed-in email and
 *  Sign out. Matches qkit's DashboardNav account-area shape; scoped to just
 *  account info + sign-out since Merqo has no Profile/Settings/Help pages. */
export function AccountMenu({ email }: { email?: string | null }) {
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
        <form action={signOutAction}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full cursor-pointer">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/account-menu.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean

- [ ] **Step 6: Commit**

```bash
git add src/components/account-menu.tsx test/components/account-menu.test.ts
git commit -m "feat: add shared AccountMenu component"
```

---

### Task 3: Wire `AccountMenu` into both headers

**Files:**

- Modify: `src/app/dashboard/(app)/layout.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**

- Consumes: `AccountMenu` from `@/components/account-menu` (Task 2).
- Produces: no new exports — these are layout files, not imported elsewhere.

- [ ] **Step 1: Update the dashboard layout**

Current content of `src/app/dashboard/(app)/layout.tsx`:

```typescript
import { requireActiveVendor } from "@/lib/vendor";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";

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
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
```

Replace with:

```typescript
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

- [ ] **Step 2: Update the admin layout**

Current content of `src/app/admin/layout.tsx`:

```typescript
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

Replace with:

```typescript
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

- [ ] **Step 3: Manual browser verification (no existing test for either layout — matches their pre-existing untested state; AGENTS.md requires exercising UI changes in a real browser before claiming done)**

Run: `pnpm dev`, sign in as a vendor and separately as a team member, confirm on both `/dashboard` and `/admin`:

- The avatar shows the correct uppercased first letter of the signed-in email.
- Clicking the avatar opens a dropdown showing the full email and a "Sign out" item.
- "Sign out" actually signs out and redirects to `/login`.
- The email text next to the avatar is hidden below the `sm` breakpoint (narrow/phone width) and visible from `sm` up — same truncation behavior as before this change.

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: prettier/eslint/tsc all clean — confirms `signOutAction` and `Button` are no longer imported in either file (an unused-import lint error would fail this step if they were)

Run: `pnpm vitest run`
Expected: full suite green

- [ ] **Step 5: Commit**

```bash
git add "src/app/dashboard/(app)/layout.tsx" "src/app/admin/layout.tsx"
git commit -m "feat: wire AccountMenu into dashboard and admin headers"
```

---

## Self-Review Notes

- **Spec coverage:** shadcn primitive install (Task 1), `AccountMenu` + `initials()` + its test (Task 2), wiring into both headers with dead-import removal (Task 3) — every "Changes" bullet in the design spec maps to a task. All three "Non-goals" are respected: no Profile/Settings/Help/Feedback items, `AdminNav` untouched, no shadcn `Avatar` primitive (a plain styled `<span>` is used, matching qkit's own approach).
- **No placeholders** — every step has complete, runnable code. The `dropdown-menu.tsx` primitive's exact export names/props (`DropdownMenuItem`'s `variant` prop specifically) were verified by installing it during plan-writing, not assumed.
- **Type consistency** — `AccountMenu`'s `email` prop type (`string | null | undefined`, via the optional `email?:`) matches both call sites' actual `user.email` type (Supabase `User.email: string | undefined`); `initials()`'s parameter type (`string | null | undefined`) is a strict superset, so no cast is needed at either call site.
- **Dedup:** this task's entire purpose is removing the duplicated email+sign-out markup between the two layout files — confirmed both Task 3 diffs remove the same two now-dead imports (`signOutAction`, `Button`) consistently.
