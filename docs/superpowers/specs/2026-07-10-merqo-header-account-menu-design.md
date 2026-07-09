# Header Account Menu (qkit-style avatar + dropdown) — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** Merqo repo only. Replaces the duplicated "plain email text + Sign
out button" pair in `/dashboard` and `/admin`'s headers with one shared
avatar-triggered dropdown component, matching qkit's `DashboardNav` account
area for visual consistency. Purely cosmetic — no new routes, no new data,
no change to auth/session behavior.

## Context

User asked why Merqo's header doesn't look like qkit's ("so merqo can be
used by tablet and phone"). Grounded this: Merqo's header _container_
styling (sticky, blur, border, height) is already near-identical to qkit's,
and both are ordinary responsive flexbox — nothing is actually broken on
small screens. The visible gap is qkit's dashboard header has a rich account
area (circular initials avatar, name, a dropdown with account info +
sign-out, tier badge, help/feedback), while both of Merqo's headers
(`src/app/dashboard/(app)/layout.tsx`, `src/app/admin/layout.tsx`) just show
raw email text next to a bare "Sign out" button. Confirmed with the user this
is a visual-consistency ask, not a specific broken-layout bug — and that
they want the avatar+dropdown treatment specifically.

Merqo has no stored display name anywhere (no `vendors`-style table with a
`name` column — vendor identity is just an email on `vendor_links`, team
identity is just a `user_id` on `merqo_team`), so the avatar can't use
qkit's `initials(name)` (first+last word). It derives from the email's first
character instead — the common single-letter avatar-fallback pattern.

## Non-goals

- **No Profile/Settings/Help/Feedback menu items.** qkit's dropdown has
  those because qkit has those pages; Merqo doesn't. The dropdown here is
  just account info (email) + Sign out — matching the _shape_ of qkit's
  account area, not porting its full feature set.
- **No change to `AdminNav`'s tab row** or any other layout element. Scope
  is the account area only.
- **No new shadcn `Avatar` primitive.** qkit's own avatar is a plain
  styled `<span>` with initials text, not the shadcn `Avatar` component —
  reusing that same lightweight approach avoids an unnecessary dependency.

## Changes

### shadcn `dropdown-menu` primitive (new, CLI-managed)

```bash
pnpm dlx shadcn@latest add dropdown-menu
```

Installs `src/components/ui/dropdown-menu.tsx` — per AGENTS.md, this file is
CLI-managed and must never be hand-edited afterward.

### `src/components/account-menu.tsx` (new)

One shared client component, consumed by both headers:

- `initials(email: string | null | undefined): string` — pure, exported,
  unit-tested. Returns the uppercased first character of the email, or `"•"`
  if there's no email to derive from.
- `AccountMenu({ email }: { email?: string | null })` — a button (avatar +
  email, email hidden below `sm` matching the current truncation behavior)
  that opens a dropdown showing the email and a "Sign out" action (posts to
  the existing `signOutAction` server action — no new sign-out logic, just
  relocated markup).

### `src/app/dashboard/(app)/layout.tsx`

Replace the `{user.email && <span>...}` + `<form action={signOutAction}>`
block with `<AccountMenu email={user.email} />`. Drop the now-unused
`signOutAction` and `Button` imports (both become dead after this change —
`Button` isn't used anywhere else in this file).

### `src/app/admin/layout.tsx`

Same replacement. The "Admin" badge next to the Wordmark is untouched (it's
part of the brand/nav area, not the account area). Drop the same two
now-unused imports.

## Error handling

None needed — this is a display component with no new data fetching, no new
failure surface. `email` being `null`/`undefined` (shouldn't happen for a
signed-in user in either layout, but the prop is typed to allow it) degrades
to a `"•"` avatar and an "Account" label instead of crashing.

## Testing

- **`initials()`:** unit tests — a normal email returns its uppercased first
  character; `null`/`undefined`/empty string all return `"•"`.
- No test for `AccountMenu`'s rendering/interaction — matches this repo's
  existing convention (no header/nav component in either app has a render
  test; `AdminNav`, the current dashboard/admin layouts, and qkit's own
  `DashboardNav` are all untested at the component level, only pure logic is
  unit-tested).
- `pnpm check` clean; full suite green; manual browser check that both
  headers render the same account-menu shape and the dropdown/sign-out still
  works.

## Open questions

None blocking.
