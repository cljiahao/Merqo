# Navbar / Account Parity — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm)
**Scope:** Bring Merqo's header avatar treatment in line with qkit's, and give the
account-menu dropdown real content (Profile, Get Help) instead of just an email
label and Sign out. Vendor-facing (`/dashboard`) and admin-facing (`/admin`)
headers both affected. Merqo repo only.

## Context

Merqo's header (`src/app/dashboard/(app)/layout.tsx`, `src/app/admin/layout.tsx`)
was already widened to `max-w-7xl` this session, matching qkit's container width.
What's left is the account area itself: `AccountMenu` (`src/components/account-menu.tsx`)
renders an initials-only avatar and a dropdown with just the signed-in email, an
optional dual-role switch link, and Sign out — deliberately thin, per its own
comment, because Merqo has no vendor table the way qkit does.

qkit's `DashboardNav` account button uses a `size-8` image avatar (falling back
to initials) with a `ring-1 ring-primary/25 ring-inset`, and its dropdown has
Profile, Board settings, Get help, Feedback, and Sign out — all backed by a real
`vendors` row with a name, an uploaded avatar, and per-board config.

Merqo's identity model is thinner: an `auth.users` row (email, and — critically —
`user_metadata.avatar_url` already populated for Google sign-ins, since Merqo's
`/login` already offers "Continue with Google") plus `merqo.vendor_links` rows
(product_slug/status/plan). There is no stall name, no board settings, no
per-vendor operational config anywhere in Merqo's schema today.

Research into how real multi-product account hubs (Google Workspace, Microsoft
365 admin center, Atlassian) route help confirmed: every one of them keeps the
hub's own help/support channel strictly separate from each product's own
help — never merged into one inbox, and never routed away from the currently
relevant product. Applying that to Merqo: "Get Help" should route to whichever
kit the vendor actually needs help with, not attempt to be a universal Merqo
support inbox.

## Goal

Match qkit's avatar sizing/styling (image + fallback, same ring treatment), and
give the account menu two real destinations — a Profile page and a Get Help
chooser — without inventing settings or support infrastructure Merqo doesn't
need yet.

## Non-goals

- **No Settings page.** Merqo has no per-vendor operational config to store
  (no booth limits, no notification thresholds, nothing schema-backed). An
  empty Settings page would be pure scaffolding. If a genuine cross-kit
  preference shows up later, it earns its own page then.
- **No password-change field on Profile.** Supabase's existing
  "Forgot password?" flow on `/login` already covers this; most vendors will
  arrive via Google OAuth with no password to change in the first place.
- **No Merqo-native feedback/support tables or admin inbox.** Get Help routes
  _out_ to each kit's own existing support flow (qkit already has one); it
  does not centralize support inside Merqo.
- **No change to the admin-side `AdminNav` tab row or the vendor dashboard's
  single-page structure.** qkit's burger + inline-links nav pattern doesn't
  transfer — qkit has 4 sibling routes (Orders/Booths/Stats/Plan), Merqo's
  vendor dashboard is one page and `/admin` already has its own tab row.

## Changes

### `src/components/account-menu.tsx` — avatar treatment

Add an `avatarUrl` prop. When present, render a `size-8` image (object-cover,
rounded, `ring-1 ring-primary/25 ring-inset`) instead of the initials box —
same visual contract as qkit's `DashboardNav`. Initials remain the fallback
when `avatarUrl` is absent (email/password sign-ins with no Google avatar).

### `src/app/dashboard/(app)/layout.tsx` and `src/app/admin/layout.tsx`

Read `user.user_metadata?.avatar_url` (same key qkit already reads) and pass it
through to `AccountMenu`. No new query — it's already on the `user` object
`requireActiveVendor()`/`requireMerqoTeam()` return.

### Account menu contents

Replace the current email-label-only dropdown body with, in order: Profile
link, Get Help (opens a small chooser — see below), a separator, the existing
dual-role switch link (unchanged, only rendered for dual-role accounts), Sign
out (unchanged).

### `src/app/dashboard/profile/` (new)

A single page: avatar (read-only display — pulled from
`user_metadata.avatar_url`, i.e. whatever Google supplied at OAuth sign-in; no
manual upload/clear, since that would need a new Supabase Storage bucket and
RLS policies Merqo has none of today, and the ask was to _pull_ the picture
from Google, not to add manual upload) and display name
(`user_metadata.full_name`, editable via `supabase.auth.updateUser`). No other
fields. Gated by `requireActiveVendor()` like the rest of `/dashboard`.

### Get Help chooser (new)

A small popover/sheet, opened from the account menu, listing the vendor's
_active_ kits (from the same `links` data `/dashboard` already loads), each
linking out to that kit's own support surface (`{kit.href}/dashboard` or
wherever that kit's support entry point lives — confirm per kit at
implementation time). Below the list, a "Contact Merqo" mailto/link, its label
and helper text explicit that it's for hub-level issues only (wrong kit
access, billing) — not a general support channel. If the vendor has zero
active kits, the chooser shows only the "Contact Merqo" option.

## Error handling

Display-name update failure surfaces inline on the Profile page (toast,
matching the existing `useAsyncAction`/`toast` pattern used elsewhere in
Merqo, e.g. `GrantForm`) and leaves the previous value in place. A vendor
with no `avatar_url` (email/password sign-in, no Google avatar) simply falls
back to the initials avatar everywhere — not an error state. The Get Help
chooser has no failure mode of its own — it's static links built from
already-loaded data.

## Testing

- `src/components/account-menu.tsx`: extend the existing test coverage (or add
  a colocated test if none exists) to cover image-avatar-present vs
  initials-fallback rendering.
- Profile page: unit test the display-name validation/update logic, plus a
  DOM test for the form (including avatar-present vs avatar-absent display),
  matching the `settings-form.dom.test.tsx`-style convention already used in
  this codebase family.
- Get Help chooser: DOM test for zero-active-kits vs some-active-kits rendering.
- `pnpm check` + `pnpm build` clean (the CI failure earlier this session — a
  client component pulling in a server-only module — is the concrete reason
  `pnpm build`, not just `pnpm check`, must be run before calling this done).

## Open questions

None blocking. If a real cross-kit preference need shows up later, that's a
new, separate spec for a Settings page — not scope creep on this one.
