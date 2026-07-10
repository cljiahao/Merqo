# Self-Serve Downgrade to Free from Merqo — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm)
**Scope:** qkit + Merqo (loopkit excluded — see Non-goals). A vendor's active,
Pro-tier `qkit` tile on Merqo's `/dashboard` gets a "Cancel Pro" action that
instantly flips them back to Free — no admin confirmation, mirroring the
[[merqo-kit-upgrade-request]] feature's shape but running the opposite
direction and without a pending-request stage.

## Context

Grounded this in qkit's actual plan-management code before designing
anything, same discipline as the upgrade-request feature:

- **The only existing code that writes `qkit.vendors.plan` is
  `setVendorPlan`** (`qkit/src/app/admin/actions.ts`) — admin-only
  (`requireAdmin()`-gated), reads the vendor's current plan first to detect a
  genuine transition, updates `plan`, records a `payments` ledger row only on
  a genuine free→pro transition with a real `amountCents`, writes an
  `admin_audit` row, and on an upgrade calls `resolveVendorRequests` to mark
  any pending `purchase_requests` `resolved`. There is no existing
  vendor-facing write path to `plan` at all — self-serve downgrade is
  entirely new surface, not an extension of something a vendor could already
  trigger themselves (unlike upgrade, which already existed as a
  request-filing flow).
- **The user explicitly chose instant, no confirmation** for this direction
  (unlike upgrade, which stays a filed request) — downgrading doesn't need
  the manual-payment-confirmation model because no payment is being taken;
  reversing to Free has no collection step to gate on.
- **A vendor might have a pending monthly upgrade request sitting in
  `purchase_requests`** (e.g. they requested Pro, haven't paid yet, then
  change their mind and cancel before an admin ever actioned it — or they're
  already Pro with a stale pending row from some other flow). Cancelling
  should also mark any pending `monthly` request `resolved`, mirroring
  `setVendorPlan`'s own upgrade-side clearing, so an admin never approves a
  payment for a plan the vendor has since reversed.
- **No audit trail for this action.** `admin_audit` requires a real
  `admin_id` (a Merqo-team member) — it doesn't fit a vendor-initiated
  action, and the sibling `vendor-status`/`upgrade-request` endpoints have no
  audit logging either. Not adding one here keeps this endpoint's footprint
  consistent with those two.
- **No `payments` ledger row.** That table only records money actually
  collected; nothing is being collected or refunded here (refunds, if any,
  happen out-of-band exactly like collection does), so writing a row would
  misrepresent a real transaction.

## Goal

A vendor on Merqo's `/dashboard`, looking at their Pro-tier qkit tile, can
click "Cancel Pro", confirm once, and be back on Free immediately — without
leaving Merqo or waiting on an admin.

## Non-goals

- **loopkit is excluded from this round** — same reasoning as
  upgrade-request: `status: "coming"` in `src/lib/kits.ts` means no vendor
  ever sees a loopkit tile in Merqo yet.
- **No refund handling.** Any money already collected for the current
  billing period is out of scope — this only flips the tier flag, same as
  qkit's admin panel already does for a manual downgrade today (there is no
  existing refund automation to mirror).
- **No proration or billing-period awareness.** Downgrading mid-cycle simply
  takes effect immediately; there's no concept of "stays Pro until period
  end" anywhere in qkit today, so this doesn't invent one.
- **No audit trail, no payments ledger row** (see Context).
- **No new secret** — reuses `MERQO_METRICS_SECRET`, same as every other
  Merqo↔qkit endpoint.
- **No change to qkit's own `/dashboard/plan` page** — that page has no
  cancel action today and this spec doesn't add one there; Merqo is the only
  entry point for this feature. (A vendor who wants to cancel from qkit
  directly is out of scope, same asymmetry that already exists for upgrade —
  qkit's own page is the one with the request button, Merqo is the one
  without, and vice versa here.)

## Changes

### qkit — `src/app/api/merqo/downgrade-request/route.ts` (new)

`POST /api/merqo/downgrade-request`, body `{ email: string }`,
`Authorization: Bearer <MERQO_METRICS_SECRET>` (`bearerOk()` copied verbatim,
same as the two sibling routes). Logic, using the service-role client:

1. Resolve `email` → an `auth.users` id via `listUsers()` (same pagination
   caveat/warning-log pattern as `upgrade-request`).
2. Confirm a `qkit.vendors` row exists for that id; read its current `plan`.
3. If already `free`, no-op success (idempotent).
4. If `pro`, update `plan = 'free'`, then mark any `pending`/`monthly`
   `purchase_requests` row for that vendor `resolved` (best-effort — a
   failure to clear a stale request is logged but does not fail the
   downgrade itself, since the plan flip is the operation that matters).
5. Respond `{success: true}` on either outcome (already-free or
   just-downgraded); `404 {success: false, error}` if no vendor row; `503`
   on a DB error; `401` on a bad bearer; `400` on a missing/invalid email.

A pure function, `resolveDowngradeOutcome(hasVendorRow: boolean, currentPlan:
"free" | "pro"): "not_found" | "already_free" | "downgrade"`, carries the
branching so it's unit-testable without a DB mock — same separation as
`resolveUpgradeOutcome`.

### Merqo — `src/lib/downgrade-request.ts` (new)

`requestKitDowngrade(kit: Pick<RegistryRow, "app_url"|"metrics_secret">,
email: string, opts?): Promise<{success: boolean; error?: string}>` — POSTs
to the kit's new endpoint. Never throws, identical defensive shape to
`requestKitUpgrade`.

### Merqo — `src/app/actions/downgrade.ts` (new)

`requestDowngrade(slug: string): Promise<{success: true} | {success: false;
error: string}>` — a Server Action, same shape as `requestUpgrade`:

1. Loads the signed-in vendor via `loadVendorContext()`.
2. Rejects (generic error) unless `hasActiveLinkFor(links, slug)` is true.
3. Looks up the kit's registry row from `listLiveProducts()` by slug.
4. Calls `requestKitDowngrade` and returns its result, mapping any
   unexpected throw to the same generic error message (matching the
   try/catch fix already applied to `requestUpgrade`).

### Merqo — `src/app/dashboard/(app)/downgrade-button.tsx` (new, client)

Small client component: a "Cancel Pro" link/button that opens a
confirmation (`AlertDialog`, already installed in Merqo's `ui/` primitives)
before calling the action — the backend has no confirmation gate, so this is
the one place a vendor is protected from a stray click. States: idle
(button, opens dialog on click), confirming (dialog open, "Cancel
subscription" / "Never mind" actions), pending ("Cancelling…", disabled),
done (replaces the button with a static "Cancelled — you're back on Free."
line), error (dialog closes, button stays clickable, a small error line
appears below it).

### Merqo — `src/app/dashboard/(app)/vendor-kit-card.tsx` (modify)

Add `{tile.plan === "pro" && <DowngradeButton slug={tile.slug} />}` next to
the existing Pro badge.

## Error handling

Same posture as upgrade-request: `requestKitDowngrade` never throws; the
server action never leaks infra details; the button's error state is
recoverable. The qkit endpoint is idempotent on the "already free" path, so
a retried request after a transient failure can never double-clear or
error out.

## Testing

- **qkit — `resolveDowngradeOutcome`:** unit tests for all three branches
  (`not_found`, `already_free`, `downgrade`).
- **qkit — route:** no dedicated route test, matching the
  `upgrade-request`/`vendor-status` precedent.
- **Merqo — `requestKitDowngrade`:** unit tests mirroring
  `requestKitUpgrade`'s test style (mocked `fetch`) — success, 401, network
  failure, bad JSON, missing app_url/secret.
- **Merqo — `downgrade` server action:** no dedicated test, same convention
  as `upgrade` (DB-touching glue; the pure `hasActiveLinkFor` check it
  reuses is already tested).
- No test for `DowngradeButton`/`VendorKitCard` — manual browser
  verification required per AGENTS.md before claiming the UI task done.
- `pnpm check` clean in both repos; full suites green.

## Open questions

None blocking.
