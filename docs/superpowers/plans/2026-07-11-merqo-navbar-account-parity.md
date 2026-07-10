# Merqo Navbar / Account Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match qkit's avatar sizing/styling in Merqo's header, and give the account-menu dropdown two real destinations — a Profile page and a Get Help chooser — without inventing a Settings page, password field, or Merqo-native support inbox the spec explicitly rules out.

**Architecture:** Two small pure-function libs (`src/lib/account.ts` for reading `avatar_url`/`full_name` off the Supabase user's `user_metadata`, and a new pure function in `src/lib/vendor.ts` for deriving the vendor's active-kit support links) feed a widened `AccountMenu` component. A new top-level `/profile` route (not under `/dashboard`, since `AccountMenu` — and therefore the Profile link — is shared by both the vendor dashboard and the admin console, and a pure-admin account must not hit `requireActiveVendor()`'s redirect when visiting it) holds the display-name form. Avatars render via a plain `<img>` — not `next/image` — since Merqo has never used `next/image` before, the avatar is a small fixed size where optimization buys nothing, and it avoids both a `next.config.ts` remote-pattern change and untested `next/image`-under-vitest behavior.

**Tech Stack:** Next.js 16 Server/Client Components, Supabase `auth.updateUser`, Zod, Vitest + Testing Library, sonner (`toast`, already mounted via `src/components/providers.tsx`).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Validate all user input with Zod `safeParse()` at every boundary (AGENTS.md) — the display-name Server Action must validate before writing.
- No secrets in `NEXT_PUBLIC_*`.
- No Settings page, no password-change field, no Merqo-native feedback/support tables or admin inbox (spec non-goals — do not add any of these).
- `Get Help` routes to each kit's own existing support surface; "Contact Merqo" is explicitly scoped in its own UI copy to hub-level issues only (wrong kit access, billing) — not a general support channel.
- Run `pnpm build`, not just `pnpm check`, before calling any task done — this session's CI failure was a client-component-imports-a-server-only-module build error that `pnpm check` (prettier/eslint/tsc) does not catch.

---

### Task 1: `getAvatarUrl` / `getDisplayName` — pure user-metadata readers

**Files:**

- Create: `src/lib/account.ts`
- Test: `test/lib/account.test.ts`

**Interfaces:**

- Consumes: nothing (pure functions, take a minimal user-shaped object).
- Produces: `getAvatarUrl(user): string | null` and `getDisplayName(user): string | null` — used by Task 3 (layouts), Task 4 (Profile page), and Task 6 (nowhere directly, but keeps the "read `user_metadata` defensively" logic in one tested place instead of duplicated inline).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/account.test.ts
import { describe, it, expect } from "vitest";
import { getAvatarUrl, getDisplayName } from "@/lib/account";

describe("getAvatarUrl", () => {
  it("returns the avatar_url string when present", () => {
    expect(
      getAvatarUrl({ user_metadata: { avatar_url: "https://x/pic.jpg" } }),
    ).toBe("https://x/pic.jpg");
  });

  it("returns null when avatar_url is absent", () => {
    expect(getAvatarUrl({ user_metadata: {} })).toBeNull();
  });

  it("returns null when avatar_url is not a string", () => {
    expect(getAvatarUrl({ user_metadata: { avatar_url: 42 } })).toBeNull();
  });

  it("returns null for a null/undefined user", () => {
    expect(getAvatarUrl(null)).toBeNull();
    expect(getAvatarUrl(undefined)).toBeNull();
  });
});

describe("getDisplayName", () => {
  it("returns the trimmed full_name when present", () => {
    expect(
      getDisplayName({ user_metadata: { full_name: "  Alice Tan  " } }),
    ).toBe("Alice Tan");
  });

  it("returns null when full_name is blank or whitespace-only", () => {
    expect(getDisplayName({ user_metadata: { full_name: "   " } })).toBeNull();
  });

  it("returns null when full_name is absent", () => {
    expect(getDisplayName({ user_metadata: {} })).toBeNull();
  });

  it("returns null for a null/undefined user", () => {
    expect(getDisplayName(null)).toBeNull();
    expect(getDisplayName(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/account.test.ts`
Expected: FAIL — `Cannot find module '@/lib/account'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/account.ts

// display_name and avatar_url are arbitrary JSON on the auth user — read
// defensively rather than trusting the shape (same convention as qkit's
// profile page, which reads the same two keys off the same untyped field).
type MetadataUser = { user_metadata?: unknown } | null | undefined;

function stringField(user: MetadataUser, key: string): string | null {
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const raw = meta?.[key];
  return typeof raw === "string" ? raw : null;
}

export function getAvatarUrl(user: MetadataUser): string | null {
  return stringField(user, "avatar_url");
}

export function getDisplayName(user: MetadataUser): string | null {
  const raw = stringField(user, "full_name");
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/account.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/account.ts test/lib/account.test.ts
git commit -m "feat: add pure user-metadata readers for avatar/display name"
```

---

### Task 2: `AccountMenu` — image avatar support

**Files:**

- Modify: `src/components/account-menu.tsx`
- Modify: `test/components/account-menu.test.tsx`

**Interfaces:**

- Consumes: nothing new at the type level — `avatarUrl?: string | null` is a plain prop, not wired to real data yet (Task 3 wires it).
- Produces: `AccountMenu({ email, avatarUrl, switchTo })` — the `avatarUrl` prop Task 3's layouts will pass.

- [ ] **Step 1: Write the failing test**

Add to `test/components/account-menu.test.tsx` (existing imports already include `render`, `screen`, `fireEvent` — this step only adds new `it` blocks inside the existing `describe("AccountMenu", ...)`):

```typescript
  it("renders an image avatar when avatarUrl is provided", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        avatarUrl="https://lh3.googleusercontent.com/a/pic.jpg"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Account menu" });
    const img = screen.getByAltText("Profile picture");
    expect(trigger).toContainElement(img);
    expect(img).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/pic.jpg",
    );
  });

  it("falls back to initials when avatarUrl is absent", () => {
    render(<AccountMenu email="vendor@example.com" />);
    expect(screen.queryByAltText("Profile picture")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account menu" }),
    ).toHaveTextContent("V");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: FAIL — `getByAltText("Profile picture")` finds no element (avatarUrl prop doesn't exist yet, so it's a no-op on `AccountMenu`).

- [ ] **Step 3: Write minimal implementation**

Replace the trigger's avatar `<span>` block in `src/components/account-menu.tsx`:

```typescript
export function AccountMenu({
  email,
  avatarUrl,
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
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
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- fixed
            // size-8 avatar; next/image's optimization overhead isn't worth
            // it here, and Merqo has no next.config.ts remote-pattern setup
            // for external avatar hosts (Google) today.
            <img
              src={avatarUrl}
              alt="Profile picture"
              className="size-8 shrink-0 rounded-md object-cover ring-1 ring-primary/25 ring-inset"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25 ring-inset"
            >
              {initials(email)}
            </span>
          )}
          {email && (
            <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
              {email}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
```

(The `DropdownMenuContent` block below is untouched by this task — Task 5 edits it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: PASS (all existing tests + the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/account-menu.tsx test/components/account-menu.test.tsx
git commit -m "feat: render an image avatar in AccountMenu when one is available"
```

---

### Task 3: Wire `avatarUrl` from both layouts into `AccountMenu`

**Files:**

- Modify: `src/app/dashboard/(app)/layout.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**

- Consumes: `getAvatarUrl` from Task 1 (`src/lib/account.ts`); `AccountMenu`'s `avatarUrl` prop from Task 2.
- Produces: nothing new for later tasks — this is a leaf wiring task.

- [ ] **Step 1: Wire the vendor dashboard layout**

In `src/app/dashboard/(app)/layout.tsx`, add the import and pass the prop:

```typescript
import { requireActiveVendor } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <AccountMenu
            email={user.email}
            avatarUrl={getAvatarUrl(user)}
            switchTo={
              isTeam ? { href: "/admin", label: "Go to admin" } : undefined
            }
          />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Wire the admin layout**

In `src/app/admin/layout.tsx`, same pattern:

```typescript
import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { hasActiveVendorAccess } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
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
  const canSwitch = user.email
    ? await hasActiveVendorAccess(user.email)
    : false;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
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
            avatarUrl={getAvatarUrl(user)}
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

- [ ] **Step 3: Verify with a full build (no dedicated test — server-layout wiring has no colocated test anywhere in this codebase today; Task 1's and Task 2's unit tests already cover the logic being wired)**

Run: `pnpm build`
Expected: succeeds, no "next/headers in client bundle" or type errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/dashboard/(app)/layout.tsx" src/app/admin/layout.tsx
git commit -m "feat: pass the signed-in user's Google avatar into both headers"
```

---

### Task 4: `/profile` page — display name form

**Files:**

- Create: `src/app/profile/page.tsx`
- Create: `src/app/profile/profile-form.tsx`
- Create: `src/app/profile/actions.ts`
- Test: `test/app/profile-form.test.tsx`

**Interfaces:**

- Consumes: `getAvatarUrl`/`getDisplayName` (Task 1), `initials` (already exported from `src/components/account-menu.tsx`), `useAsyncAction` (`src/hooks/use-async-action.ts`), `ActionResult` (`src/lib/action-result.ts`).
- Produces: `updateDisplayNameAction(formData: FormData): Promise<ActionResult>` and the `/profile` route — not consumed by any other task in this plan, but is the destination Task 5's Profile link points to.

- [ ] **Step 1: Write the failing test**

```typescript
// test/app/profile-form.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/profile/actions", () => ({
  updateDisplayNameAction: vi.fn(),
}));

import { updateDisplayNameAction } from "@/app/profile/actions";
import { ProfileForm } from "@/app/profile/profile-form";

describe("ProfileForm", () => {
  it("renders the image avatar when avatarUrl is provided", () => {
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl="https://lh3.googleusercontent.com/a/pic.jpg"
        displayName={null}
      />,
    );
    expect(screen.getByAltText("Profile picture")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/pic.jpg",
    );
  });

  it("falls back to initials when avatarUrl is absent", () => {
    render(
      <ProfileForm email="vendor@example.com" avatarUrl={null} displayName={null} />,
    );
    expect(screen.queryByAltText("Profile picture")).not.toBeInTheDocument();
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it("pre-fills the display name input", () => {
    render(
      <ProfileForm email="vendor@example.com" avatarUrl={null} displayName="Alice Tan" />,
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("Alice Tan");
  });

  it("submits the trimmed name and shows a success toast on success", async () => {
    vi.mocked(updateDisplayNameAction).mockResolvedValue({ success: true });
    render(
      <ProfileForm email="vendor@example.com" avatarUrl={null} displayName={null} />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateDisplayNameAction).toHaveBeenCalled());
  });

  it("shows the error message when the action fails", async () => {
    vi.mocked(updateDisplayNameAction).mockResolvedValue({
      success: false,
      error: "Enter a name (1-80 characters).",
    });
    render(
      <ProfileForm email="vendor@example.com" avatarUrl={null} displayName={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(updateDisplayNameAction).toHaveBeenCalled(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/app/profile-form.test.tsx`
Expected: FAIL — `Cannot find module '@/app/profile/profile-form'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/profile/actions.ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export async function updateDisplayNameAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { success: false, error: "Enter a name (1-80 characters)." };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.displayName },
  });
  if (error) {
    return { success: false, error: "Couldn't update your name. Try again." };
  }
  return { success: true };
}
```

```typescript
// src/app/profile/profile-form.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { updateDisplayNameAction } from "./actions";
import { useAsyncAction } from "@/hooks/use-async-action";
import { initials } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  email,
  avatarUrl,
  displayName,
}: {
  email: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}) {
  const { pending, run } = useAsyncAction();
  const [name, setName] = useState(displayName ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    run(async () => {
      const formData = new FormData();
      formData.set("displayName", name);
      const res = await updateDisplayNameAction(formData);
      if (res.success) {
        toast.success("Profile updated");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see the
          // same note in account-menu.tsx.
          <img
            src={avatarUrl}
            alt="Profile picture"
            className="size-14 shrink-0 rounded-full object-cover ring-1 ring-primary/25 ring-inset"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/12 font-mono text-lg font-semibold text-primary ring-1 ring-primary/25 ring-inset"
          >
            {initials(email)}
          </span>
        )}
        <div>
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">
            {avatarUrl
              ? "Picture from your Google account"
              : "No profile picture"}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <div className="flex gap-2">
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

```typescript
// src/app/profile/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/account";
import { ProfileForm } from "./profile-form";

export const revalidate = 0;

// Deliberately NOT under /dashboard: AccountMenu (and therefore the Profile
// link) is shared by both the vendor dashboard and the admin console, so a
// pure-admin account (no active kit) must be able to reach this page without
// requireActiveVendor() bouncing them to /dashboard/pending. Gated by
// "signed in" only, matching neither requireActiveVendor() nor
// requireMerqoTeam()'s stricter checks.
export default async function ProfilePage() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
        Profile
      </h1>
      <ProfileForm
        email={user.email ?? null}
        avatarUrl={getAvatarUrl(user)}
        displayName={getDisplayName(user)}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/app/profile-form.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/profile
git add test/app/profile-form.test.tsx
git commit -m "feat: add /profile page with a Google avatar and editable display name"
```

---

### Task 5: `AccountMenu` — Profile link + Get Help submenu

**Files:**

- Modify: `src/components/account-menu.tsx`
- Modify: `test/components/account-menu.test.tsx`

**Interfaces:**

- Consumes: `DropdownMenuSub`/`DropdownMenuSubTrigger`/`DropdownMenuSubContent` (already exported from `src/components/ui/dropdown-menu.tsx` — no new shadcn component needed).
- Produces: `AccountMenu({ email, avatarUrl, activeKits, switchTo })` where
  `activeKits: { slug: string; name: string; href: string }[]` — the shape
  Task 6's pure function must produce.

- [ ] **Step 1: Write the failing test**

Add to `test/components/account-menu.test.tsx`:

```typescript
  it("always shows Profile and a Contact Merqo link", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    fireEvent.pointerDown(
      screen.getByRole("menuitem", { name: "Get help" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Contact Merqo" }),
    ).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("lists each active kit's support link inside Get help", () => {
    render(
      <AccountMenu
        email="vendor@example.com"
        activeKits={[
          { slug: "qkit", name: "qkit", href: "https://qkit-sg.vercel.app" },
        ]}
      />,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.pointerDown(
      screen.getByRole("menuitem", { name: "Get help" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "qkit support" }),
    ).toHaveAttribute("href", "https://qkit-sg.vercel.app/dashboard");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: FAIL — no "Profile"/"Get help" menu items exist yet.

- [ ] **Step 3: Write minimal implementation**

Update the `@/components/ui/dropdown-menu` import block in
`src/components/account-menu.tsx` (the `Link` import already exists — only
the dropdown-menu import block changes) and replace the `DropdownMenuContent`
body:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

```typescript
export function AccountMenu({
  email,
  avatarUrl,
  activeKits = [],
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  activeKits?: { slug: string; name: string; href: string }[];
  switchTo?: { href: string; label: string };
}) {
  // ...trigger unchanged from Task 2...
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            Get help
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {activeKits.map((k) => (
              <DropdownMenuItem key={k.slug} asChild className="cursor-pointer">
                <a href={`${k.href}/dashboard`} target="_blank" rel="noreferrer">
                  {k.name} support
                </a>
              </DropdownMenuItem>
            ))}
            {activeKits.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem asChild className="cursor-pointer">
              <a href="mailto:hello@merqo.sg?subject=Merqo%20account%20help">
                Contact Merqo
              </a>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {switchTo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={switchTo.href}>{switchTo.label}</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
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

Note: `"Contact Merqo"`'s subject line makes explicit (per the spec's
non-goal) that this address is for hub-level issues, not product bugs — the
mailto's `subject` param is intentionally generic ("Merqo account help") so
it doesn't read as a catch-all support form.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: PASS (all existing + 2 new tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/account-menu.tsx test/components/account-menu.test.tsx
git commit -m "feat: add Profile link and a per-kit Get Help chooser to AccountMenu"
```

---

### Task 6: Wire `activeKits` into the vendor dashboard layout

**Files:**

- Modify: `src/lib/vendor.ts`
- Modify: `test/lib/vendor.test.ts`
- Modify: `src/app/dashboard/(app)/layout.tsx`

**Interfaces:**

- Consumes: `VendorLink` type, `KITS` (`src/lib/kits.ts`) — already imported in `vendor.ts`.
- Produces: `activeKitSupportLinks(links: VendorLink[], kits?: Kit[]): { slug: string; name: string; href: string }[]` — the exact shape `AccountMenu`'s `activeKits` prop (Task 5) expects.

- [ ] **Step 1: Write the failing test**

First, add `activeKitSupportLinks` to the existing import block at the top of
`test/lib/vendor.test.ts`:

```typescript
import {
  resolveHome,
  dashboardGateDestination,
  tilesForLinks,
  hasRenderableActiveKit,
  addableKits,
  hasActiveLinkFor,
  activeKitSupportLinks,
} from "@/lib/vendor";
```

Then add this new `describe` block (mirrors the existing `addableKits`/
`hasRenderableActiveKit` test blocks in that file):

```typescript
describe("activeKitSupportLinks", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "",
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "",
      status: "coming" as const,
    },
  ];

  it("includes only active links whose kit has an href", () => {
    const out = activeKitSupportLinks(
      [
        { product_slug: "qkit", status: "active", plan: "free" },
        { product_slug: "loopkit", status: "active", plan: null },
      ],
      kits,
    );
    expect(out).toEqual([
      { slug: "qkit", name: "qkit", href: "https://qkit-sg.vercel.app" },
    ]);
  });

  it("excludes waitlisted links", () => {
    const out = activeKitSupportLinks(
      [{ product_slug: "qkit", status: "waitlist", plan: null }],
      kits,
    );
    expect(out).toEqual([]);
  });

  it("excludes links to a slug not in the KITS registry", () => {
    const out = activeKitSupportLinks(
      [{ product_slug: "ghostkit", status: "active", plan: null }],
      kits,
    );
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: FAIL — `activeKitSupportLinks is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/vendor.ts`, near `hasRenderableActiveKit`:

```typescript
/** The vendor's active kits that have a real support destination, for the
 *  account menu's Get Help chooser. A kit with no `href` (not yet live)
 *  can't be linked to, so it's excluded even if somehow marked active. */
export function activeKitSupportLinks(
  links: { product_slug: string; status: GrantStatus }[],
  kits: Kit[] = KITS,
): { slug: string; name: string; href: string }[] {
  const bySlug = new Map(kits.map((k) => [k.slug, k]));
  const out: { slug: string; name: string; href: string }[] = [];
  for (const l of links) {
    if (l.status !== "active") continue;
    const kit = bySlug.get(l.product_slug);
    if (!kit?.href) continue;
    out.push({ slug: kit.slug, name: kit.name, href: kit.href });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: PASS (all existing + 3 new tests)

- [ ] **Step 5: Wire it into the vendor dashboard layout**

In `src/app/dashboard/(app)/layout.tsx`, replace `requireActiveVendor()`'s
destructure and pass the new prop (the admin layout is deliberately left
alone here — see the note below):

```typescript
import { requireActiveVendor, activeKitSupportLinks } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isTeam, links } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <AccountMenu
            email={user.email}
            avatarUrl={getAvatarUrl(user)}
            activeKits={activeKitSupportLinks(links)}
            switchTo={
              isTeam ? { href: "/admin", label: "Go to admin" } : undefined
            }
          />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
```

`requireActiveVendor()` already returns `links` (confirmed in
`src/lib/vendor.ts`) — no new query. The admin layout is not touched by this
step: a pure-admin account has no `vendor_links` loaded there today (only the
boolean `hasActiveVendorAccess` for the switch link), and loading the full
list just for Get Help's rarely-used dual-role case is out of scope here —
those accounts still get "Contact Merqo" via `AccountMenu`'s default empty
`activeKits`.

- [ ] **Step 6: Verify with a full build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts "src/app/dashboard/(app)/layout.tsx"
git commit -m "feat: surface the vendor's active kits in the Get Help chooser"
```

---

### Task 7: Full verification pass

- [ ] **Step 1: Run the full check**

Run: `pnpm check`
Expected: clean (prettier, eslint — warnings for the two intentional
`no-img-element` disables are suppressed inline, so no new warnings — and
`tsc --noEmit`).

- [ ] **Step 2: Run the full build**

Run: `pnpm build`
Expected: succeeds — this is the step that would have caught this session's
earlier CI failure; do not skip it.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass, including every test added in Tasks 1–6.

- [ ] **Step 4: Commit if anything was left unstaged**

```bash
git status --short
```

If clean, nothing to do — each task already committed its own changes.

---

## Self-Review Notes

- **Spec coverage:** avatar sizing/styling match (Tasks 2–3), Profile page
  with avatar + display name and no password field (Task 4), no Settings
  page (never added), Get Help routes to each kit's own support plus a
  hub-scoped "Contact Merqo" (Task 5), no Merqo-native support tables/inbox
  (never added) — every spec requirement maps to a task.
- **No placeholders** — every step has complete, runnable code; the one
  literal value worth flagging is `hello@merqo.sg` in Task 5, a reasonable
  placeholder support address (confirm/replace with the team's real inbox
  before shipping — not a blocking TODO, the code is fully functional as
  written).
- **Type consistency** — `AccountMenu`'s `activeKits` prop shape
  (`{ slug, name, href }[]`, Task 5) exactly matches
  `activeKitSupportLinks`'s return type (Task 6); `getAvatarUrl`/
  `getDisplayName` (Task 1) are the only places `user_metadata` is read,
  consumed identically by Task 3's layouts and Task 4's Profile page.
- **Deviation from the spec, called out explicitly:** the spec's Changes
  section names `src/app/dashboard/profile/` as the new page's location;
  this plan places it at `src/app/profile/` instead. Reason: `AccountMenu`
  is shared by both `/dashboard` and `/admin`, so the Profile link must be
  reachable from a pure-admin account too — nesting it under `/dashboard`
  would route a non-vendor admin through `requireActiveVendor()`'s redirect
  logic and bounce them to `/dashboard/pending` instead of the page they
  clicked. The new location is gated by "signed in" only, matching what
  both account types actually need.
