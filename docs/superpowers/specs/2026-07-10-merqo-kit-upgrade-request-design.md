# Self-Serve Upgrade Request from Merqo — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** qkit + Merqo (loopkit excluded — see Non-goals). The "Upgrade to
Pro" link on a vendor's active `qkit` tile in Merqo becomes a real button
that files a monthly-Pro upgrade request directly from Merqo, instead of
deep-linking the vendor to qkit's own `/dashboard/plan` page to click it
there themselves.

## Context

Grounded this in qkit's and loopkit's actual code before designing anything,
because the user's original ask ("make the toggle actually flip the
vendor's plan") doesn't match how billing works on either kit today:

- **Neither kit has automated billing.** qkit's `/dashboard/plan` page has an
  `UpgradeCta` that calls a Server Action, `requestUpgrade(option)`
  (`qkit/src/app/actions/purchase.ts`) — it inserts a row into
  `qkit.purchase_requests` (`kind: "event"|"monthly"`, `status: "pending"`)
  and nothing else. Payment (PayNow/cash) is collected out-of-band, and a
  Merqo-team admin manually resolves the request and flips
  `qkit.vendors.plan` once paid. loopkit has the exact same shape
  (`upgrade_requests`, one tier, `requestUpgrade()` in
  `loopkit/src/app/dashboard/plan/actions.ts`).
- **`requestUpgrade()` is idempotent already** — a second call while a
  request of the same kind is still `pending` is a no-op success. Neither
  kit's own UI shows a persistent "you have a pending request" state
  anywhere; it's fire-and-confirm.
- **qkit's real tier model is three rungs** (free / event pass / pro), not
  the two (free/pro) Merqo currently syncs and displays — confirmed via
  `qkit/src/app/dashboard/plan/page.tsx`'s `Tier` badge. This spec does not
  fix that broader gap; it only adds a monthly-Pro request path, which maps
  cleanly onto the existing `plan` field Merqo already tracks.
- **`requestUpgrade()` is a Next.js Server Action bound to the vendor's own
  qkit cookie session** — it cannot be invoked cross-origin from Merqo.
  Reaching it from Merqo requires a new HTTP route on qkit, the same shape
  as the existing `/api/merqo/vendor-status` (bearer-authed, resolves email
  → vendor row, does the DB write via the service-role client instead of a
  user session).

Three scope questions were explicitly settled with the user before this
design was written:

1. The toggle **files a request**, it does not instantly grant Pro — this
   respects the existing manual-payment-confirmation model rather than
   bypassing it.
2. Merqo's button requests **monthly only** — qkit's other option (a
   short-lived "event pass") doesn't fit a persistent dashboard tile and is
   left to qkit's own plan page.
3. The new endpoint **reuses the existing shared `MERQO_METRICS_SECRET`**
   rather than a new write-scoped secret — the blast radius of misuse is
   low (worst case: extra pending rows an admin already triages before
   granting anything real, no financial mutation happens automatically).

## Goal

A vendor on Merqo's `/dashboard`, looking at their (free-tier) qkit tile,
can click "Upgrade to Pro" and have the request land in qkit's own admin
queue — without leaving Merqo or re-authenticating on qkit's domain.

## Non-goals

- **loopkit is excluded from this round.** loopkit is still `status:
"coming"` in `src/lib/kits.ts` — no vendor sees a loopkit tile in Merqo
  yet, so wiring an upgrade-request endpoint for it now would be dead code.
  The pattern here is designed to be trivially mirrored once loopkit goes
  live (same shape as the existing vendor-status endpoint's precedent).
- **No instant/automated payment collection.** Out of scope entirely —
  this only files the same request a vendor could already file themselves
  on qkit.
- **No downgrade / cancel-Pro path.** Neither kit has one today; Merqo
  doesn't invent one.
- **No "event pass" request kind.** Monthly only (see Context, point 2).
- **No persistent "request pending" indicator in Merqo across page loads.**
  Matches qkit's own UI, which has none either — a fresh page load after
  requesting still shows "Upgrade to Pro"; clicking it again is a harmless
  no-op (idempotent at the DB layer).
- **No new secret.** Reuses `MERQO_METRICS_SECRET` (see Context, point 3).

## Changes

### qkit — `src/app/api/merqo/upgrade-request/route.ts` (new)

`POST /api/merqo/upgrade-request`, body `{ email: string }`,
`Authorization: Bearer <MERQO_METRICS_SECRET>` (same `bearerOk()`, copied
verbatim from the sibling routes). Logic, using the service-role client:

1. Resolve `email` → an `auth.users` id via `supabase.auth.admin.listUsers()`
   (same pattern as the existing vendor-status route).
2. Confirm a `qkit.vendors` row exists for that id (a matched auth user who
   never onboarded as a vendor can't file a request).
3. Check for an existing `pending` `purchase_requests` row for that vendor
   with `kind = 'monthly'`.
4. If found, no-op success (idempotent, matching `requestUpgrade`'s own
   behavior). If not found and the vendor exists, insert
   `{vendor_id, kind: 'monthly'}` (status defaults to `'pending'` per the
   `purchase_requests` table).
5. Respond `{success: true}` on either outcome; `{success: false, error}`
   with `404` if no vendor row was found, `503` on a DB error, `401` on a
   bad bearer, `400` on a missing/invalid email.

A new pure function, `resolveUpgradeOutcome(hasVendorRow: boolean,
hasPendingRequest: boolean): "not_found" | "already_pending" | "create"`,
carries the branching logic above so it's unit-testable without a DB mock —
the route itself stays a thin HTTP+DB wrapper around it, same separation as
`resolveVendorStatus`/the vendor-status route.

### Merqo — `src/lib/upgrade-request.ts` (new)

`requestKitUpgrade(kit: Pick<RegistryRow, "app_url"|"metrics_secret">, email:
string, opts?): Promise<{success: boolean; error?: string}>` — POSTs to the
kit's new endpoint with the bearer header and a JSON `{email}` body. Never
throws (mirrors `checkVendorStatus`'s defensive shape exactly: bad
app_url/secret, network failure, non-200, bad JSON all collapse to
`{success: false, error: "..."}`).

### Merqo — `src/lib/vendor.ts` (extend)

New pure function `hasActiveLinkFor(links: {product_slug: string; status:
GrantStatus}[], slug: string): boolean` — the one-slug version of
`hasRenderableActiveKit`'s check, reused by the new server action's
authorization gate.

### Merqo — `src/app/actions/upgrade.ts` (new)

`requestUpgrade(slug: string): Promise<{success: true} | {success: false;
error: string}>` — a Server Action:

1. Loads the signed-in vendor via `loadVendorContext()`.
2. Rejects (generic error, no leak of "which kits exist") unless
   `hasActiveLinkFor(links, slug)` is true — a vendor can only request an
   upgrade for a kit they're an active user of, even if this action were
   invoked directly bypassing the UI.
3. Looks up the kit's registry row from `listLiveProducts()` by slug.
4. Calls `requestKitUpgrade` and returns its result (mapped to a
   vendor-facing message on failure — "Could not send your request. Try
   again in a moment." — never the raw infra error).

### Merqo — `src/app/dashboard/(app)/upgrade-button.tsx` (new, client)

Small client component mirroring qkit's own `UpgradeCta` shape (a button +
`useTransition`, no toast — Merqo has no `Toaster` mounted anywhere and its
existing waitlist form already uses inline status text instead of toasts,
so this follows that convention, not qkit's). States: idle button ("Upgrade
to Pro"), pending ("Sending…", disabled), sent (replaces the button with a
static "Request sent — we'll set you up shortly." line), error (button
stays clickable, a small error line appears below it).

### Merqo — `src/app/dashboard/(app)/vendor-kit-card.tsx` (modify)

Replace the `{tile.plan === "free" && tile.href && <a ...>Upgrade to
Pro</a>}` block with `{tile.plan === "free" && <UpgradeButton
slug={tile.slug} />}`.

## Error handling

Every layer degrades to a user-facing error message, never a crash:
`requestKitUpgrade` never throws; the server action never leaks infra
details; the button's error state is recoverable (the vendor can just click
again). The qkit endpoint's idempotency means a retried request after a
transient failure is always safe — it can never create a duplicate pending
row.

## Testing

- **qkit — `resolveUpgradeOutcome`:** unit tests for all three branches
  (`not_found`, `already_pending`, `create`).
- **qkit — route:** no dedicated route test, matching the existing
  `/api/merqo/vendor-status` precedent (route is a thin wrapper; the branch
  logic is what's tested).
- **Merqo — `requestKitUpgrade`:** unit tests mirroring
  `checkVendorStatus`'s test style (mocked `fetch`) — success, 401, network
  failure, bad JSON, missing app_url/secret.
- **Merqo — `hasActiveLinkFor`:** unit tests — true for a matching active
  link, false for a waitlist link to the same slug, false for no link at
  all, false for an active link to a _different_ slug.
- **Merqo — `upgrade` server action:** no dedicated test (DB-touching glue,
  matching the `syncVendorKits`/`admin.ts` convention — only the pure
  authorization check it calls, `hasActiveLinkFor`, is unit-tested).
- No test for `UpgradeButton`/`VendorKitCard` — matches these files'
  pre-existing untested state; manual browser verification required per
  AGENTS.md before claiming the UI task done.
- `pnpm check` clean in both repos; full suites green.

## Open questions

None blocking.
