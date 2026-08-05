# profile

## Purpose

Shared account-settings page — stall name, social links, profile icon,
display name, and sign-in password, each saved independently through the
channel that owns that data (shared `merqo.vendor_profile` for stall
name/social links vs. the Supabase auth user for icon/display name/
password). Reachable from both the vendor dashboard and the admin console;
gated on "signed in" only. Follows the cross-kit standard at
`docs/business/2026-07-21-profile-settings-page-standard.md`, the same
pattern qkit/loopkit/paykit's `dashboard/profile/` implement.

## Contents

- `actions.ts` — `updateStallName(input)` and `updateSocialLinks(input)` server actions. Both validate with their Zod schema (`profileNameSchema`, `socialLinksSchema`), read the vendor's current shared profile via `getOrCreateVendorProfile`, then write the one changed field through `upsertVendorProfile` — both from `@/lib/merqo-vendor-profile`, which calls the shared `merqo.vendor_profile` table's RPC functions directly (merqo's own server client already defaults to the `merqo` schema — no cross-schema indirection needed here, unlike a dependent kit's copy of this file). Both `revalidatePath("/", "layout")` so the dashboard/admin headers and account menu immediately reflect the change. Display name, avatar, and password are explicitly **not** handled here — they live on the auth user and are set client-side via `supabase.auth.updateUser`.
- `page.tsx` — `ProfilePage()` (server, `revalidate = 0`): gates on a signed-in Supabase user, reads the vendor's shared profile via `getOrCreateVendorProfile`, reads `display_name`/`avatar_url` defensively off `user.user_metadata` (`@/lib/account`), and renders `ProfileForm` with the vendor's stall name, display name, email, id, avatar URL, and social links.
- `profile-form.tsx` — `ProfileForm({ stallName, displayName, email, vendorId, avatarUrl, socialLinks })` client component with five independently-saved sections, each inside `@merqo/ui`'s `Section`, laid out via `@merqo/ui`'s `TwoColumnSections` (two independent `flex flex-col gap-5` stacks side by side on `md`+ — never a CSS grid, see the standard doc §2.3 for why). Column order is the cross-kit standard: left stacks stall name (`profileNameSchema` → `updateStallName` server action), profile icon (`@merqo/ui`'s `ImageUploader`, backed by `uploadVendorAvatar` from `@/lib/image-upload-adapter` → `supabase.auth.updateUser({ data: { avatar_url } })`), and change password (`passwordChangeSchema` → `supabase.auth.updateUser({ password })`, clearing the fields on success); right stacks display name (`displayNameSchema` → `supabase.auth.updateUser({ data: { display_name } })`) above social links (`SocialLinksFields` + `socialLinksSchema` → `updateSocialLinks` server action); email is shown read-only.

## Connectivity

Reachable from `account-menu.tsx`'s "Profile" item (both `/dashboard` and `/admin` headers) — that link is `@merqo/ui`'s `AccountMenu` hardcoded route, `/dashboard/profile`, which `src/app/dashboard/profile/page.tsx` redirects here. `page.tsx` calls the server Supabase client directly (no `requireActiveVendor()`/`requireMerqoTeam()` gate — deliberately looser, see the comment in `page.tsx`) and renders `profile-form.tsx`, which calls the server actions `updateStallName`/`updateSocialLinks` in `actions.ts` for stall name/social links and the browser Supabase client (`@/lib/supabase/client`) directly for avatar/display-name/password, all validated against schemas in `@/lib/schemas`. Profile-icon uploads go through `@/lib/image-upload-adapter` to the `vendor-avatars` Storage bucket (`supabase/migrations/0015_vendor_avatars_bucket.sql`).

## Parent

See the repo root [README.md](../../../README.md) for the full `src/app/`
layout and how this page fits the rest of Merqo.
