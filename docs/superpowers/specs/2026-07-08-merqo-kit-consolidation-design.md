# Merqo Kit Consolidation (6-Product Lineup) — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorm)
**Scope:** Align the Merqo repo to the consolidated 6-kit product lineup decided
Jul 2026. Update the kit-family config (`kits.ts`, `ecosystem.ts`), reframe the
landing from a qkit-centered hub to six standalone peers, and add a data migration
that renames/retires product slugs. Does **not** touch the vendor access model.

## Context

Merqo consolidated from 11 planned kits to **6 standalone products**, each on its own
Vercel URL with its own signup, under the Merqo house brand. Guiding rule: _"Merqo
Admin is the hub for 2+ kit vendors — never the gatekeeper. No flagship, no forced
bundling."_ Every kit ships a free tier (all core features) + paid tiers; essentials
are never split across kits (e.g. table management + menu editing stay inside qkit;
payments + receipts are one product, paykit).

Today the lineup lives in two config files — `src/lib/kits.ts` (the waitlist/roadmap
source of truth: qkit, loopkit, shopkit, tapkit, slotkit) and `src/lib/ecosystem.ts`
(the landing "kit-stacker" graph, which currently treats qkit as an un-removable
`HUB_SLUG` anchor). The `merqo.products` registry (seeded by `0002`) backs the
`vendor_links.product_slug` FK.

Phase 1 (admin console) and 2a (vendor portal) are merged; `0003` is applied.

## Goal

The landing, waitlist, and admin/vendor surfaces reflect the real 6-kit lineup with
correct names, and the landing reads as six peer products that optionally integrate —
not one flagship everything plugs into.

## The 6-kit lineup

| slug     | status (`kits.ts`) | tagline                                                              | canonical URL       |
| -------- | ------------------ | -------------------------------------------------------------------- | ------------------- |
| qkit     | live               | Take orders and run your queue from a QR code — no app, no hardware. | qkit.vercel.app     |
| loopkit  | coming             | Stamp cards, points and tiers that bring customers back.             | loopkit.vercel.app  |
| shopkit  | planned            | A simple storefront for your catalog, checkout and pre-orders.       | shopkit.vercel.app  |
| paykit   | planned            | Collect PayNow, cards and cash — with receipts and e-invoices.       | paykit.vercel.app   |
| stockkit | planned            | Track stock in and out, and know what each dish really costs.        | stockkit.vercel.app |
| reachkit | planned            | Reach customers by SMS, email and WhatsApp — and collect reviews.    | reachkit.vercel.app |

**Kept:** qkit, loopkit (the loyalty product — points/tiers/stamps; name retained as
the broader retention-loop framing), shopkit. **Renamed:** tapkit → paykit.
**New:** stockkit, reachkit. **Dropped:** slotkit (bookings — not in the final six;
reversible, it's config + a seed row).

## Non-goals

- **No access-model change.** `vendor_links`-as-grant, `/admin/vendors` grant/revoke,
  and the `/dashboard` active-link gate are untouched. The "hub-not-gatekeeper"
  reframe belongs to the later "Merqo Admin after 2+ kits" phase.
- **No outbound links to unlaunched kits.** `href` is set only for `live` kits (qkit);
  planned/coming kits show the waitlist/roadmap treatment, not a dead link. Each kit's
  canonical URL is recorded as a comment for when it launches.
- **No qkit-repo work** (notification sound, card-color timing, notification prefs) and
  **no stampkit/loopkit or other kit scaffolds** — separate repos, separate cycles.

## Changes

### `src/lib/kits.ts`

Replace the `KITS` array with the six above (order: qkit, loopkit, shopkit, paykit,
stockkit, reachkit). Only qkit carries `href`. Update `QKIT_URL`'s default from
`qkit-sg.vercel.app` to `qkit.vercel.app` (still `NEXT_PUBLIC_QKIT_URL`-overridable).
`LIVE_KITS`, `COMING_KITS`, `WAITLISTABLE_SLUGS` derive unchanged — `WAITLISTABLE_SLUGS`
becomes `["loopkit"]` (only `coming`), matching today's "only coming kits are
waitlistable" behavior.

### `src/lib/ecosystem.ts` (landing kit-stacker)

- **Remove the forced-anchor semantics of `HUB_SLUG`** so no kit is un-removable — the
  landing must not imply a flagship. (Keep the `qkit` node default-stacked if the
  stacker needs a starting state, but it is removable like any other.)
- Rewrite `KIT_NODES` to the six kits (drop slotkit; add paykit, stockkit, reachkit;
  keep qkit/loopkit/shopkit), re-laying-out positions in the fixed viewBox.
- Rewrite `KIT_EDGES` to honest, optional integrations (edges still render only when
  both endpoints are stacked):
  - `qkit → loopkit` — "points": finished orders earn loyalty points.
  - `paykit → qkit` — "pay": take payment as the order is placed.
  - `shopkit → qkit` — "orders": online orders drop into your queue.
  - `paykit → shopkit` — "checkout": powers checkout on your store.
  - `qkit → reachkit` — "reviews": ask for a review after a visit.
  - (stockkit renders as a standalone node — no forced edge; it stands on its own.)
- Keep `nodeBySlug` / `activeEdges`. If `HUB_SLUG` is removed, update the one
  kit-stacker consumer that reads it.

Keep `ecosystem.ts` slugs in lockstep with `kits.ts` (the file comment already says so).

### `supabase/migrations/0004_kit_consolidation.sql` (idempotent, FK-safe)

`vendor_links.product_slug → products.slug` has no ON UPDATE CASCADE, so retirement
carries FK refs before deleting rows:

1. Upsert the new registry rows (`paykit`, `stockkit`, `reachkit`) and set `app_url`
   for all six kits (`on conflict (slug) do update` for `app_url`/`name`).
2. Carry any `tapkit` waitlist links onto `paykit`
   (`update vendor_links set product_slug='paykit' where product_slug='tapkit'`),
   then delete leftover `tapkit` links.
3. `delete from merqo.products where slug in ('tapkit','slotkit')` — no-op if they were
   never seeded (they weren't waitlistable, so almost certainly have no rows).

New rows use `status='coming_soon'` (the only non-`live` value the `products.status`
CHECK allows); the finer `live/coming/planned` distinction lives in `kits.ts` for
display. loopkit and shopkit product rows are left intact (loopkit keeps its waitlist
signups); their `app_url` is set in step 1.

## Consumers (auto-update from config)

`kit-stacker` (graph-canvas, module-list), `kit-grid`, `benefits`, `footer`
(`QKIT_URL`), the public waitlist action (`WAITLISTABLE_SLUGS`), and every `/admin`
surface read the config or the registry — they reflect the new lineup once `kits.ts`,
`ecosystem.ts`, and `0004` land. The vendor `/dashboard` `tilesForLinks` reads
`href`, so a vendor's live-kit tiles keep their open-links.

## Error handling

Migration `0004` is idempotent and FK-safe (carry-then-delete order), so a re-run or a
partially-seeded live DB converges. Config changes are static — no runtime failure
surface; a stale slug in `ecosystem.ts` not present in `kits.ts` is caught by the test
below, not at runtime.

## Testing

- **Vitest — migration:** `0004` string-asserts the new rows (`paykit`, `stockkit`,
  `reachkit`), the `tapkit → paykit` carry-over precedes the `tapkit` delete, and
  `slotkit`/`tapkit` are removed from `products`.
- **Vitest — config invariants** (`kits.ts`): exactly 6 kits; exactly one `live`
  (qkit); `WAITLISTABLE_SLUGS` equals the `coming` set; no `slotkit`/`tapkit` slugs.
- **Vitest — ecosystem coherence:** every `KIT_NODES` / `KIT_EDGES` slug exists in
  `kits.ts` (guards drift); no `slotkit`.
- **Playwright:** landing smoke still renders (kit-stacker "Stack all" present); no
  dead outbound links to unlaunched kits.
- `pnpm check` clean; full suite green.

## Open questions

- **slotkit / bookings** — dropped per the six-kit decision; re-add as a 7th `planned`
  kit (config + seed row) if bookings turns out to matter for the target sellers.
- Kit-stacker node **positions** for six nodes in the 520×440 viewBox are art-directed;
  the implementer picks a balanced layout (no single center) — this is the one visual
  detail not pinned here.
