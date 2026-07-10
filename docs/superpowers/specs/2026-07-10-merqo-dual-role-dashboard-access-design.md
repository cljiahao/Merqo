# Dual-Role Dashboard Access — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** `src/lib/vendor.ts`, `src/components/account-menu.tsx`,
`src/app/admin/layout.tsx`, `src/app/dashboard/(app)/layout.tsx`.

## Context

Triggered by a live report: signing in landed on `/admin` when `/dashboard`
was expected. Traced the actual routing:

- `resolveHome({isTeam, hasActiveKit})` (`src/lib/vendor.ts`) is pure and
  already unit-tested — a team member always routes to `/admin`,
  **regardless of `hasActiveKit`**. This is deliberate, from an earlier
  phase, not an accidental bug.
- `requireActiveVendor()` gates `/dashboard` itself: it calls `resolveHome`
  and redirects away from anything that isn't `/dashboard` — so a team
  member is blocked from `/dashboard` even by direct URL, unconditionally.

Compared this against qkit, per the user's request to follow its patterns.
qkit's login always pushes to `/dashboard`
(`src/app/(auth)/login/page.tsx:88,98`), but `src/app/dashboard/layout.tsx`
immediately redirects an admin to `/admin` (`if (await isAdmin(user.id))
redirect("/admin")`, with the comment "Admins have no vendor row and don't
use the vendor dashboard"). **qkit assumes admin and vendor are always
different people** — a real assumption for its actual user base, but not
one that holds for Merqo, where the same account (as used throughout this
whole session) legitimately holds both team membership and active vendor
kits at once.

So the real gap isn't "wrong redirect" — `resolveHome`'s default is
correct and matches qkit's own "admins land on admin" pattern. The gap is
that a **dual-role account has no way to reach `/dashboard` at all**, even
though it has real, active vendor access there.

Confirmed with the user before designing:

1. Post-login default is unchanged — a team member (dual-role or not)
   still lands on `/admin`.
2. `/dashboard` becomes reachable for a dual-role account (not hard-blocked
   purely for being on the team).
3. A visible switch link in the account menu, both directions — not a
   silent unblock a user would only discover by typing the URL.

## Goal

An account that is both a Merqo-team member and holds an active vendor kit
can reach both `/admin` and `/dashboard`, with a one-click way to move
between them. Pure vendors and pure team members see zero behavior change.

## Non-goals

- **No change to post-login routing.** `resolveHome` and
  `src/app/post-login/route.ts` are untouched — team still defaults to
  `/admin`.
- **No "last visited area" memory or any other smart default.** Confirmed
  out of scope — the switch is always a manual, explicit click.
- **No change for single-role accounts.** A pure vendor (not on the team)
  or a pure team member (no active vendor kit) sees no new UI and no
  behavior change — the switch link only appears when both facts are true.
- **No change to `requireMerqoTeam()`'s signature or cost.** It's called
  from many pages (`admin/page.tsx`, `admin/vendors/page.tsx`,
  `admin/team/page.tsx`, `admin/products/page.tsx`,
  `admin/vendors/[email]/page.tsx`, plus the two action files) — adding an
  extra query to it would tax every one of those unnecessarily. The new
  "does this team member also have vendor access" check is scoped to
  `admin/layout.tsx` only, where it's actually needed.

## Changes

### `src/lib/vendor.ts` (extend)

New pure function, mirroring `resolveHome`'s shape but with different
semantics — it decides when `/dashboard` itself may be **blocked**, not
where a fresh login lands:

```ts
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

`requireActiveVendor()` changes to use it, and now also returns `isTeam`
(already fetched internally via `loadVendorContext` — free, no new query):

```ts
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

New lightweight, best-effort helper — used only by `admin/layout.tsx` to
decide whether to show the switch link. Deliberately does not re-check team
membership (the caller, gated by `requireMerqoTeam`, already knows that):

```ts
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

### `src/components/account-menu.tsx` (extend)

New optional prop, rendered as a menu item above the existing separator +
Sign out — same `DropdownMenuItem asChild` + `Link` pattern qkit's own
`DashboardNav` already uses for its Profile/Settings items:

```tsx
export function AccountMenu({
  email,
  switchTo,
}: {
  email?: string | null;
  switchTo?: { href: string; label: string };
}) {
  // ...
  return (
    <DropdownMenu>
      {/* trigger unchanged */}
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

(Needs `import Link from "next/link";` added — everything else in the
component is unchanged, including the sign-out fix from the earlier
session incident.)

### `src/app/admin/layout.tsx` (modify)

```tsx
const { user } = await requireMerqoTeam();
const canSwitch = await hasActiveVendorAccess();
// ...
<AccountMenu
  email={user.email}
  switchTo={
    canSwitch
      ? { href: "/dashboard", label: "View vendor dashboard" }
      : undefined
  }
/>;
```

### `src/app/dashboard/(app)/layout.tsx` (modify)

```tsx
const { user, isTeam } = await requireActiveVendor();
// ...
<AccountMenu
  email={user.email}
  switchTo={isTeam ? { href: "/admin", label: "Go to admin" } : undefined}
/>;
```

## Error handling

`hasActiveVendorAccess` degrades to hiding the link on a read error —
correct because it's a convenience affordance, not an access gate; the
actual `/dashboard` access remains protected by `requireActiveVendor`
regardless of whether the link shows. `requireActiveVendor`'s own
`loadVendorContext` call keeps its existing throw-loudly behavior for real
read failures (unchanged from before this spec).

## Testing

- **`dashboardGateDestination`** (`src/lib/vendor.ts`): new unit tests
  covering all four `(isTeam, hasActiveKit)` combinations — the
  `(true, true) → "/dashboard"` case is the one this whole feature exists
  to add; the other three must stay exactly as `resolveHome`'s equivalent
  cases already assert, to prove nothing regressed for single-role
  accounts.
- **`requireActiveVendor`, `hasActiveVendorAccess`**: no dedicated test —
  DB-touching glue, matches the existing convention (`loadVendorContext`
  itself has no direct test either; only the pure functions it composes
  with are tested).
- **`AccountMenu`**: extend `test/components/account-menu.test.tsx` — a
  render with `switchTo` present shows a link with the given href/label; a
  render without it shows no such link. Matches the file's existing
  render-test style.
- No test for the two layout files — matches their pre-existing untested
  state (Server Component composition, not logic).
- `pnpm check` clean; full suite green.

## Open questions

None blocking.
