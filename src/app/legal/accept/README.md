# accept

## Purpose

The acceptance interstitial `requireVendorSession` (`src/lib/vendor.ts`)
redirects a signed-in vendor to when their terms/privacy acceptance is
stale or missing. Deliberately not gated by `requireVendorSession` or any
other legal-gate check itself — that would be the gate redirecting to the
page it exists to satisfy, an infinite loop.

## Contents

- `page.tsx` — reads the `next` search param and renders the client
  `accept-form.tsx`.
- `accept-form.tsx` — client component wrapping `@merqo/ui`'s
  `TermsAcceptanceCheckbox` (legal name + agree checkbox, submit disabled
  until both are filled) inside a `<form>` whose `action` is
  `acceptLegalTerms`; a hidden `next` field carries the redirect target
  through the server action.
- `actions.ts` — `acceptLegalTerms` server action. Re-checks the signed-in
  user, reads the submitted `legal_name` from `FormData` (throws if
  empty — the server action is the real trust boundary, not the client's
  disabled-button state) and the vendor's real `ip`/`user_agent` via
  `headers()`, then inserts both `terms` and `privacy` rows into
  `merqo.legal_acceptances` directly (service-role client — `authenticated`
  only has `select` on that table) as two independent inserts, each
  tolerating its own `23505` duplicate-key violation as success — a
  conflict on one doc must never block the other from being recorded.
  Redirects to `next`, validated via `safe-redirect.ts`'s
  `safeRedirectPath` (rejects absolute URLs, `//`, `/\`, and embedded
  control characters) so a crafted `next` value can't produce an open
  redirect.
- `actions.test.ts` — covers: missing/empty `legal_name` throws before
  any insert; both rows genuinely carry `legal_name`/`ip`/`user_agent` in
  the insert call; a `23505` on one doc doesn't block the other; unsafe
  `next` values fall back to `/dashboard`.

## Parent

[legal](../README.md)
