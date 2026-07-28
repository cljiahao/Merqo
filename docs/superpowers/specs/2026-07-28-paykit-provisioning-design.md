# paykit Push-Provisioning Design

**Status:** Draft
**Repos touched:** paykit, merqo
**Depends on:** 2026-07-28-vendor-push-provisioning (qkit + loopkit; merged, PR #50 / #39 / #16). This design extends the same push-provisioning pattern to paykit, with one key divergence forced by paykit's data model.

## Background

qkit and loopkit each got a `POST /api/merqo/vendor-provision` route: bearer-secured, takes `{ user_id }`, creates a bare tenant row with all-default values, returns `{ ok, already_existed, plan }`. Merqo hub's "Activate all my kits" button calls all live kits' routes via `Promise.allSettled` and marks each `vendor_links` row `active` on success.

paykit cannot use this pattern unmodified. Its tenant table, `paykit.vendor_payment_config`, has fields with no safe default:

```sql
payee_name text not null,                       -- no default
uen text, mobile text,                          -- one required (CHECK), neither has a safe placeholder
constraint vendor_payment_config_one_proxy check ((uen is not null and mobile is null) or (uen is null and mobile is not null))
```

A placeholder `payee_name`/`uen`/`mobile` isn't just invalid — it's actively dangerous. A wrong PayNow proxy could misdirect a real customer payment. So there is nothing safe to insert. paykit's config is, and must remain, vendor-authored through its own dashboard form (`paykit/dashboard/config`).

paykit also has zero `/api/merqo/*` routes today (confirmed: `find src/app/api` → only `v1/checkout`, `v1/vendors`) and its own registered priorities (`docs/meta/2026-07-17-paykit-task-registry.md`) don't include merqo-hub discoverability at all. This design adds paykit's first two such routes, scoped to identity/status only.

## Approach

**Push-provision identity only, then deep-link to config.** One click on merqo's dashboard tells paykit "this vendor exists," and paykit answers honestly with whatever it already knows — never creating a row. If no config exists yet, merqo shows a distinct "finish payment setup" tile that deep-links straight into `paykit/dashboard/config`, instead of the normal active-kit tile. A vendor who already configured PayNow directly on paykit (bypassing merqo) is picked up correctly too, since the check is a live existence read, not a one-time write.

This was chosen over the alternative (skip push provisioning for paykit entirely, treat it as a plain external-link "add" card like the display-only fallback merqo already has) because the user explicitly preferred a real activation click with a tracked status over a bare external link — it keeps paykit inside the same "Activate all my kits" flow and dashboard vocabulary as every other kit, rather than carving out a visibly different second-class experience.

## Components

### paykit: `GET /api/merqo/vendor-status` (new)

Mirrors qkit/loopkit's existing vendor-status contract. Bearer-secured (`MERQO_METRICS_SECRET`, paykit's own value — distinct secret from provision, distinct from every other kit's, per the established per-kit-secret convention).

- Input: `?user_id=<uuid>` query param.
- Reads: `select plan from paykit.vendor_payment_config where vendor_id = :user_id`.
- Response: `{ active: boolean, plan: string | null }` — `active: true` iff a row exists.

### paykit: `POST /api/merqo/vendor-provision` (new)

Bearer-secured (`MERQO_PROVISION_SECRET`, paykit's own value). Takes `{ user_id: uuid }` (Zod-validated, same shape as qkit/loopkit).

- Does the _same_ existence read as vendor-status. Writes nothing, ever.
- Response: `{ ok: true, needs_setup: boolean, plan: string | null }`.
  - `needs_setup: true` when no `vendor_payment_config` row exists (first-time activation — the common case).
  - `needs_setup: false` when the vendor already configured PayNow directly on paykit before ever touching merqo hub (idempotent, honest either way — re-clicking "Activate" never regresses a configured vendor back to "needs setup").
- No FK/unique-violation branches apply (no insert happens), so this route's error surface is strictly smaller than qkit/loopkit's: 401 (bad bearer), 400 (bad JSON / bad UUID), 500 (unexpected read error).

### merqo: `merqo.vendor_links.status` gains `needs_setup`

Migration `supabase/migrations/000X_vendor_links_needs_setup_status.sql`:

```sql
alter table merqo.vendor_links drop constraint vendor_links_status_check;
alter table merqo.vendor_links add constraint vendor_links_status_check
  check (status in ('active', 'waitlist', 'needs_setup'));
```

(Constraint name to be confirmed against the actual auto-generated name in the live schema before the migration is finalized — Postgres default-names an unnamed column CHECK as `<table>_<column>_check`.)

Same migration (or a paired one) flips the existing loopkit-style bug: `update merqo.products set status = 'live' where slug = 'paykit'` — required for paykit to be reachable by `listLiveProducts()` at all, and to get a `provision_secret` column populated.

`src/lib/vendor-grants.ts:6`: `GrantStatus = "active" | "waitlist" | "needs_setup"`.

`src/lib/vendor.ts`'s `tilesForLinks` (currently a binary `status === "active" ? active-bucket : pending-bucket` split) gets a real third branch: `needs_setup` produces its own tile shape (distinct label + a link straight to the kit's config page, carried on `KitTile` via a new optional `configHref` populated from `kits.ts`) rather than falling into the generic waitlist/pending tile. The existing `=== "active"` binary checks elsewhere (`hasActiveLinkFor`, `hasRenderableActiveKit`) are correct unchanged — `needs_setup` is correctly "not active yet" for those.

### merqo: `provisionVendorKit` / `ProvisionResult` thread `needs_setup` through

`src/lib/vendor-sync.ts`'s existing `provisionResponseSchema` gains an optional `needs_setup: z.boolean().optional()` field (absent/`undefined` for kits that don't have the concept, e.g. qkit/loopkit — never `false` by default, so existing kits' behavior is untouched). `provisionVendorKit`'s success branch upserts `vendor_links.status` as `result.needs_setup ? "needs_setup" : "active"` instead of unconditionally `"active"`.

`ActivateKitsButton` (`src/components/dashboard/activate-kits-button.tsx`) already merges per-call results by slug and shows per-kit outcomes; it gets one more render branch: a `needs_setup` result shows "Payment setup needed" with a link to the kit's config page, styled distinctly from both the success toast and the retry-failure state (it isn't a failure — the click succeeded — so it must not show a retry button).

## Data Flow

**Provision (push):** vendor clicks "Activate paykit" → `activateKitsAction(["paykit"])` → `provisionVendorKit("paykit", userId, opts)` → POST paykit's `vendor-provision` → paykit reads `vendor_payment_config` existence, returns `{ ok: true, needs_setup, plan }` (no write) → merqo upserts `vendor_links.status` (`needs_setup` or `active`) → `revalidatePath` → dashboard renders the matching tile.

**Status refresh (pull):** wherever merqo already re-syncs link state (existing pattern, unchanged), `vendor-status` re-checks `vendor_payment_config` existence — once the vendor finishes config directly on paykit, the next pull-sync flips `needs_setup` → `active` on its own. No additional push path is needed for that transition.

## Error Handling

Both new paykit routes reuse the existing `provisionBearerOk`/`bearerOk` helpers and Zod-at-the-boundary convention already established in qkit/loopkit — 401 on bad bearer, 400 on malformed JSON or failed schema validation, 500 on an unexpected Supabase read error. `provisionVendorKit`'s existing never-throw/3s-timeout/one-retry wrapper needs no changes: a `needs_setup` response is a normal 200, not an error, so it flows through the existing success path unchanged; only the upsert's status value branches on it.

## Testing

- paykit: `test/api/merqo/vendor-status.test.ts` and `test/api/merqo/vendor-provision.test.ts`, mirroring qkit/loopkit's existing route-test shape (bearer missing, bad JSON, bad UUID, `needs_setup: true` case, `needs_setup: false` case, 500-on-read-error case). A new `test/lib/merqo-auth.test.ts` if paykit doesn't already have one (to be confirmed during planning — paykit's existing lib test coverage hasn't been audited yet).
- merqo: extend `src/lib/vendor-sync.test.ts`-equivalent coverage with a `needs_setup` case for `provisionVendorKit`'s status-upsert branch; extend `src/lib/vendor.test.ts`-equivalent with a `tilesForLinks` case asserting the new third tile shape; a `*.dom.test.tsx` case for `ActivateKitsButton`'s new `needs_setup` render branch.
- No live-DB tests — same hermetic (migration-SQL-text-read) convention as the qkit/loopkit work.

## Out of Scope

- paykit's own registered priorities (T1: wire qkit checkout to paykit, T2: wire shopkit to paykit, T3: HitPay auto-verify) — untouched by this design.
- Any UI/flow changes to paykit's own `/dashboard/config` form.
- stockkit — tracked as a fully separate design conversation (product decision on live-tier promotion, not yet made).
- Phase 2 true SSO / seamless kit switching — still blocked on the undated `*.merqo.net` subdomain migration, unrelated to this work.
