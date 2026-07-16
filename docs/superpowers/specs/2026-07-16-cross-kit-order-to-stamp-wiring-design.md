# Cross-Kit Order-to-Stamp Wiring — Status Audit & Reconciliation — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorm)
**Owner:** Clarence
**Scope:** qkit-order-completed → loopkit-stamp-award only (stockkit/reachkit
have no repos yet — explicitly out of scope). Repos referenced: merqo, qkit,
loopkit, paykit (prior art only). Docs-only deliverable — no application code
or Supabase migrations from this spec/plan.

---

## 1. Purpose

This spec was commissioned to find out how much groundwork exists for
"qkit order completion auto-awards a loopkit stamp" against the target
architecture described in `docs/business/2026-07-12-merqo-roadmap.md`
("Architecture: Cross-Kit Data Flow" — a Supabase Edge Function firing on
`merqo.metrics` inserts) and to write a spec + plan for whatever remains.

**Finding: the premise was wrong.** This is not a greenfield gap. The exact
feature was independently designed, planned, and **fully implemented and
committed** across all three repos on 2026-07-13/14, one day after the
roadmap doc — see
`docs/superpowers/specs/2026-07-13-qkit-loopkit-auto-award-design.md` and
its paired plan. It shipped via a **different, deliberately-chosen
architecture** than the roadmap doc describes (§2), not the Edge-Function
design.

This document's job is therefore not to design new wiring — it's to record
ground truth, reconcile the roadmap doc against what actually shipped, and
scope the small amount of real work that remains (verification, not
construction). The paired plan
(`docs/superpowers/plans/2026-07-16-cross-kit-order-to-stamp-wiring.md`)
is a verification/reconciliation plan, not a build plan.

---

## 2. Ground truth (verified against code and git history, 2026-07-16)

### 2.1 What actually shipped

| Repo      | Artifact                                                                           | Purpose                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| merqo     | `supabase/migrations/0008_kit_events.sql`                                          | Creates `merqo.kit_events` (id, vendor_id, kit_name, event_type, event_data, created_at) + `merqo.emit_metric()` SECURITY DEFINER insert function, granted to `authenticated, service_role` only. Committed `750da50`, `4ee597c`.                                                                                                                                       |
| qkit      | `supabase/migrations/0051_emit_order_completed.sql`                                | Trigger on `public.orders` (`status` → `completed`, guarded against re-fire) calls `merqo.emit_metric(vendor_id, 'qkit', 'order_completed', {order_id})`. Committed `9911880`.                                                                                                                                                                                          |
| qkit      | `src/app/order/[boothId]/[orderNumber]/earn-link.tsx`                              | Server component on the order-status page: on `status === 'completed'`, fetches loopkit's config endpoint; renders a claim link only if enabled; fails closed (renders nothing) on any error/timeout — never blocks the order page. Committed `6bb5336`.                                                                                                                |
| loopkit   | `supabase/migrations/0019_qkit_earn.sql`, `0020_qkit_earn_functions.sql`           | `loopkit.qkit_earn_config` (vendor's chosen program + on/off), `loopkit.qkit_earn_events` (order_id PK — one award per order, ever), `cards.customer_name`. `qkit_earn_lookup`/`qkit_earn_commit` SECURITY DEFINER functions read `merqo.kit_events` **directly, cross-schema, from inside Postgres** — never via a Supabase JS client. Committed `0ab254f`..`8c6bd21`. |
| loopkit   | `src/app/api/merqo/qkit-earn-config/route.ts`                                      | `GET`, bearer-secured (`MERQO_METRICS_SECRET`, same convention as the existing `/api/merqo/metrics`), returns `{enabled, program_name}` for qkit's link-render check. Committed `6c4ed31`.                                                                                                                                                                              |
| loopkit   | `src/app/dashboard/qkit-earn-settings.tsx` + `actions.ts:saveQkitEarnConfigAction` | Vendor-facing setting, one program + on/off toggle. **Pro-gated** via `isPro()` (`src/app/dashboard/actions.ts:348-357`) — confirmed real, not a stub. Committed `9babd68`, later migrated to shadcn Select/Switch (`aa2989d`).                                                                                                                                         |
| loopkit   | `src/app/earn/page.tsx` + `earn/actions.ts`                                        | Public, unauthenticated claim page. Reads `merqo.kit_events` via `qkit_earn_lookup`, shows phone+name form, commits via `qkit_earn_commit`. Idempotent on repeat visits (`qkit_earn_events` PK on `order_id`). Committed `2b00bcd`. Scope cut to stamp-type programs only (`c304ee5`) — plant/streak explicitly deferred, tracked as a documented follow-up, not a gap. |
| All three | `docs/DEPLOY.md`                                                                   | Each repo already documents the cross-repo migration deploy order for this feature (merqo `:87-90`, qkit `:8-11`, loopkit `:119-131`, `:244-253`).                                                                                                                                                                                                                      |

Every step of the 2026-07-13 plan's 10 tasks has a matching commit. This is
a shipped MVP, not a partial scaffold.

### 2.2 Why this diverges from the roadmap doc's architecture

The roadmap doc (`docs/business/2026-07-12-merqo-roadmap.md`) describes:
`INSERT into merqo.metrics` → `Edge Function fires` → HTTP-style dispatch to
reacting kits. **None of that was built for this integration**, and the
2026-07-13 spec explains why (§3 of that doc, paraphrased): qkit, loopkit,
and merqo already share **one Postgres project**. Routing a same-database
fact through an HTTP Edge Function and a signed callback re-invents
verification a same-DB read gets for free, and doesn't generalize cleanly —
each future kit pair would invent its own signed-link contract. A thin
shared table (`merqo.kit_events`, not `merqo.metrics` — different name,
same intent) that any kit can read directly inside a `SECURITY DEFINER`
Postgres function does the same job with less surface area, no network
hop, and no HMAC/token-expiry machinery to get subtly wrong.

This is a **strictly better fit for a customer-facing claim flow**, where
the "reaction" is a page render decision at request time, not a background
side effect. It is not automatically the right fit for every future
cross-kit case (§5).

### 2.3 Other prior-art findings (from the original task's research asks)

- **`merqo/src/lib/metrics-client.ts`** is unrelated to this push flow —
  it's the existing **pull**: merqo's `/dashboard` fetches each kit's own
  `GET /api/merqo/metrics` (bearer-secured via `merqo.products.metrics_secret`)
  to show kit health/volume. The 2026-07-13 spec deliberately reused this
  auth _convention_ (bearer header, same env var) for
  `qkit-earn-config`, not the pull _mechanism_ — that endpoint is qkit-side
  push-adjacent (called from qkit's order page, not from merqo).
- **Endpoint naming drift**: the roadmap doc specifies `/api/kit/metrics` +
  `/api/kit/status`. Shipped code in both qkit and loopkit uses
  `/api/merqo/metrics` + `/api/merqo/vendor-status` instead. Functionally
  equivalent, differently named — a roadmap-doc-only inaccuracy (§4).
- **paykit's `kit_api_keys` pattern** (`paykit/src/lib/kit-auth.ts`, sha256-hashed
  per-kit secrets in a DB table, `Bearer <kitSlug>:<secret>`) is real,
  shipped, and more scoped/rotatable than the single shared
  `MERQO_METRICS_SECRET` env var qkit/loopkit's `/api/merqo/*` routes use
  today. It was **not** adopted for the qkit-earn-config endpoint — that
  endpoint predates checking paykit's pattern, and reworking a shipped,
  tested, working endpoint's auth without a forcing reason is not
  justified by this audit alone (§5).
- **Pro-gating** is fully resolved, not an open question: `saveQkitEarnConfigAction`
  genuinely calls `isPro()` before allowing the toggle. No stub.
- **Failure/retry story** is fully resolved and deliberate, not a gap:
  `EarnLink` fails closed (renders nothing) on any fetch error or timeout,
  documented and unit-tested (`earn-link.dom.test.tsx`, three cases
  including "renders nothing when the fetch fails"). One known,
  **accepted** limitation: the check happens once, at order-status
  page-load — if loopkit is transiently down at that moment, the claim
  link never appears for that page view even after loopkit recovers (no
  polling/retry, no other touchpoint like email/SMS exists in qkit to
  resurface it later). This was an explicit MVP tradeoff in the
  2026-07-13 spec (§6: "never blocks the order flow — purely additive"),
  not an oversight. Flagged in §6 below as accepted, not actioned.

---

## 3. What "the rest" actually is

Given §2, there is no remaining feature-construction work scoped to
qkit-order-completed → loopkit-stamp-award. What remains is verification
and documentation reconciliation:

1. **Confirm live deploy status.** Every artifact in §2.1 is committed to
   its repo's `supabase/migrations/` or `src/`, but a local, read-only
   audit cannot confirm the three migrations (`merqo` 0008, `qkit` 0051,
   `loopkit` 0019+0020) are actually applied to the **live** shared
   Supabase project, nor that all three apps are deployed with the
   matching code (in particular qkit's `NEXT_PUBLIC_LOOPKIT_URL` env var,
   called out as a silent-failure risk in qkit's own `docs/DEPLOY.md`
   note). This is an ops check, not new code.
2. **Confirm the cross-repo manual smoke test was actually run.** The
   2026-07-13 plan's Task 10 Step 2 specifies a 7-point manual smoke test
   across all three deployed apps (no automated cross-repo e2e exists by
   design — matches both kits' existing limited e2e scope). Whether this
   was executed is not recorded anywhere checkable from the repos.
3. **Reconcile the roadmap doc.** `docs/business/2026-07-12-merqo-roadmap.md`'s
   "Architecture: Cross-Kit Data Flow" section still describes the
   Edge-Function-on-`merqo.metrics` design as _the_ cross-kit pattern, with
   no mention that the first (and so far only) real cross-kit integration
   deliberately chose a different pattern for good, generalizable reasons.
   Left uncorrected, this actively misleads whoever designs the next
   cross-kit case (shopkit→paykit, or a future stockkit auto-decrement) into
   assuming Edge Functions are the established default when the actual
   working precedent is same-DB direct reads. This edit is scoped as a plan
   task, not performed by this spec.

No code, no migrations, and no new architecture decisions belong in this
deliverable's scope — see the plan for the concrete, small task list.

---

## 4. Endpoint naming reconciliation (informational, not actioned)

The roadmap doc's stated contract ("Each kit exposes `/api/kit/metrics`
(push) and `/api/kit/status` (health)") does not match either shipped kit's
actual routes (`/api/merqo/metrics`, `/api/merqo/vendor-status`). This is
noted for completeness since the original research explicitly asked about
it; it is a documentation-only mismatch with no functional impact (merqo's
`metrics-client.ts` and the vendor-status callers already call the real,
shipped paths, not the roadmap doc's names) and is folded into the same
roadmap-doc reconciliation task in §3.3 rather than tracked separately.

---

## 5. Open questions flagged for human review

These are genuine judgment calls this audit did not resolve, deliberately
left to a human rather than decided unilaterally:

1. **Should `/api/merqo/*` bearer auth across qkit/loopkit eventually
   migrate to paykit's `kit_api_keys` (per-kit, revocable, hashed) pattern?**
   Not a blocker today — the shared-secret pattern works and is tested —
   but as a 4th/5th kit joins this auth surface, a single shared secret
   becomes harder to rotate without a coordinated multi-repo deploy.
   Recommend revisiting when the next kit (shopkit or paykit's own
   cross-kit surface) needs a new `/api/merqo/*` endpoint, not as a
   standalone migration now.
2. **Is the "check happens once at page-load" failure mode (§2.3) worth
   fixing** (e.g. a background retry, or resurfacing the claim link
   elsewhere) given it's already a deliberate, documented, tested MVP
   choice? Recommend leaving as-is unless it surfaces as a real vendor
   complaint — added to the plan as an explicitly-not-actioned item, not
   silently dropped.
3. **Should stockkit/reachkit's future automatic (no-customer-action)
   reactions reuse `merqo.kit_events` (polled or triggered) or genuinely
   need an Edge Function?** Out of scope here (those kits don't exist yet),
   but the 2026-07-13 spec's own §7 already anticipates this exact
   question ("revisit when a kit needs fully automatic... reaction, e.g.
   stockkit auto-decrement") — worth deciding when those kits are actually
   scoped, not now.

---

## 6. Testing / verification approach

No new automated tests — this deliverable produces no code. Verification is
entirely the plan's manual/ops tasks (§3.1, §3.2): confirming live migration
state and executing the already-specified manual smoke test. The existing
unit test coverage cited in §2.1/§2.3 (loopkit's `earn-link`, `actions`,
`qkit-earn-config` route tests; merqo's `kit-events-schema` test) already
covers the code-level correctness of what shipped and needs no rework.
