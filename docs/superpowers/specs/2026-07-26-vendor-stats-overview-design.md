# Vendor stats overview — Design

**Date:** 2026-07-26
**Status:** Approved (brainstorm) — merqo side implemented; per-kit contract
below is a follow-on spec for qkit/loopkit/paykit's own repos.
**Scope:** merqo (dashboard revamp + the new client/UI, done now). qkit,
loopkit, paykit (implement the `vendor-metrics` endpoint below, on their own
timeline — not part of this change).

## Context

`/dashboard` today is pure access management: which kits a vendor has, plan
tier, add/upgrade/downgrade. Zero stats. Two problems this surfaces:

1. **Trust gap.** `syncVendorKits`'s `last_verified_at` column
   (migration 0005) has never been shown to the vendor — there's no visible
   confirmation that "add a kit → see it here" actually works, which matters
   more now that `/dashboard` re-syncs on every load (see the resync fix
   merged just before this).
2. **No proof of value.** Merqo's admin team already has a full metrics
   pipeline (`fetchProductMetrics`, `/api/merqo/metrics`) — but it's
   aggregate, kit-wide, internal-only. A vendor never sees their _own_
   numbers anywhere on merqo, so there's nothing here that argues for using
   merqo over just living inside each kit separately.

Goal (per founder): ease of use/integration → retention, and visible
"there's real meaning in using this" — not a hard upsell-conversion push.

## Goal

1. Surface `last_verified_at` on each active kit tile as a quiet trust
   signal.
2. Sharpen the "kits you don't have yet" section into an actual cross-sell
   narrative instead of a generic list.
3. Define a vendor-scoped metrics contract (`GET /api/merqo/vendor-metrics`)
   each kit can implement to report a vendor's _own_ numbers — mirroring the
   existing `vendor-status`/`upgrade-request` bearer-secret + email pattern.
4. Build the merqo-side fetch + UI now, degrading gracefully to a plain
   "not connected yet" state for any kit that hasn't implemented the
   endpoint — so the UI is real and reviewable today even before any kit
   ships its side.

## Non-goals

- **No combined cross-kit ROI number.** Research turned up no solid
  precedent for honestly combining heterogeneous units (qkit's orders,
  loopkit's stamps, paykit's dollars) into one figure — deferred to a
  possible v2, once individual per-kit numbers have proven valuable on
  their own.
- **No hard usage-cap upgrade nudges** (e.g. "you've hit 80% of your free
  tier"). The ask here is retention/trust, not conversion pressure — that
  can be revisited separately if the founder wants it later.
- **Not building the per-kit endpoint itself.** This spec defines the
  contract; each kit's own repo implements it on its own schedule, same
  pattern as the other cross-kit convergence specs in this repo.

## The vendor-metrics contract

`GET {kit.app_url}/api/merqo/vendor-metrics?email=<vendor email>`,
`Authorization: Bearer {metrics_secret}` — same secret already shared for
`vendor-status`/`metrics`/`upgrade-request`.

Response, one small envelope, kit fills in its own metrics rather than a
forced common schema (a "stamps redeemed" count and a "collected this
month" dollar figure aren't the same kind of number):

```json
{
  "product": "qkit",
  "generated_at": "2026-07-26T04:00:00Z",
  "metrics": [
    { "key": "orders_7d", "label": "Orders (7d)", "value": "42" },
    {
      "key": "avg_wait",
      "label": "Avg wait",
      "value": "6 min",
      "hint": "down from 9 min last week"
    }
  ]
}
```

- `metrics`: ordered, kit decides content and pre-formats `value` as a
  display string (units/currency are the kit's call, not merqo's).
  Recommend 2-4 entries — a phone-checking owner shouldn't need to scroll a
  kit tile.
- `hint`: optional, one short line of context. Plain and factual, not a
  sales pitch (see "Non-goals" — no nudge language).
- 401 on secret mismatch, matching every other cross-kit endpoint.

## merqo-side behavior

`fetchVendorMetrics(kit, email)` — mirrors `fetchProductMetrics`/
`checkVendorStatus` exactly: 5s timeout, never throws, missing
`app_url`/`metrics_secret` or any non-conforming response degrades to
`{ok: false}`. A `{ok: false}` result renders as "Stats aren't connected
here yet" on the kit's tile — worded as a real, in-progress feature state,
not an error.

Fetched per active kit, in parallel, from `DashboardPage` alongside the
existing `syncVendorKits` call — a metrics-fetch failure never touches the
kit tile's actual management controls (Open / upgrade / downgrade), since
it renders in its own block underneath them.
