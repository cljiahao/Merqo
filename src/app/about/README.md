# about

## Purpose

The public "Why Merqo" page — the origin story and a founder/business-name
line matching the legal docs' phrasing, linked from the landing `Nav` and
`Footer`.

## Contents

- `page.tsx` — `AboutPage`, an async Server Component. Reflects the
  session (same pattern as `page.tsx` at the app root) so its `Nav` CTA
  reads "Dashboard" for a signed-in vendor and "Sign in" otherwise. Wraps
  the same `Nav`/`Footer` from `@/components/landing/` as the landing
  page, so this page keeps normal site navigation instead of the bare,
  chrome-less layout `legal/*` uses. The story itself is `@merqo/ui`'s
  shared `AboutMerqo` component (one source, reused by every kit's own
  `/about` page too) — this page supplies only the `Nav`/`Footer` and
  the "See the kits" CTA as `AboutMerqo`'s `children`.
- `page.test.tsx` — covers the founder-note copy, the `#kits` CTA link,
  and that the signed-in-vendor Dashboard CTA links to `/post-login`
  (never straight to `/admin`, which would bounce a non-team vendor to
  `/no-access`).

## Connectivity

Linked from `Nav` (`src/components/landing/nav.tsx`) and `Footer`
(`src/components/landing/footer.tsx`) on every page that renders either.

## Parent

[app](../README.md)
