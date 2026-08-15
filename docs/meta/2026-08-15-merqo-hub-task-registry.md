# merqo hub — Task Registry (2026-08-15 refresh)

Refresh of `2026-07-17-merqo-hub-task-registry.md` (that doc is kept as-is
for history — see the superseding note at its top). Every item from the
07-17 registry was re-verified against current code, migrations, and git
history rather than carried forward unchecked — one item (T1) had already
shipped since 07-17 and is reclassified here.

Since 07-17 the repo also went through a same-day 08-15 sweep unrelated to
this registry's items: a templateCentral 5.14→5.15 harness cherry-pick
(#41), a `next`/`eslint-config-next` bump to 16.2.12 (#43), first-time
`next.config.ts` security headers (#42), a `sonarjs.configs.recommended`
ESLint rollout with 18 real findings fixed (#44), a fix for `kits.ts` vs
`ecosystem.ts` status drift that had loopkit/paykit showing as not-live on
the public landing page (#45), and a flaky-test root-cause fix in
`activate-kits-button.test.tsx` (#46). None of those map onto this
registry's T1-T4 — noted here only as the context for why this refresh
was due.

## Done

- **T1 — Domain placeholders in `docs/DEPLOY.md`.** Both placeholders
  (`<qkit-domain>` at the old line ~45, `<merqo-domain>` at the old line
  ~56) were filled in by PR **#11** (`45b8cae`, "docs: fill in current
  deploy domains", merged 2026-07-25) with the actual live default
  domains (`qkit-sg.vercel.app`, `merqo-sg.vercel.app`), plus a new
  "Custom domain (planned, not yet purchased)" note (`docs/DEPLOY.md`
  lines 65-68) so the still-pending `merqo.io`/`qkit.merqo.io` purchase is
  tracked transparently rather than left as a bare placeholder. The
  underlying domain _purchase_ is still a pending business decision, but
  that was always framed as a business-timeline item, not an engineering
  gap — DEPLOY.md itself already documents what to update once it lands,
  so there's nothing further for this registry to track.

## Still open

- **T2 — No admin pricing panel / no `pricing_config` table.** Confirmed
  still absent: `supabase/migrations/` runs 0001-0016 with no
  pricing-related table, `src/app/admin/` has no `pricing/` route
  (current children: `feedback/`, `products/`, `team/`, `vendors/` +
  root files), and no file under `src/`, `supabase/`, or `docs/DEPLOY.md`
  mentions "pricing". Genuinely unstarted — still correctly deferred per
  the original sequencing (revisit once there's more than one paying
  vendor).
- **T3 — No real billing / Stripe integration.** Confirmed still absent:
  the only repo-wide hit for "stripe" is a design-reference code comment
  in `src/components/dashboard/kit-previews/mockup-window.tsx` (cites
  Stripe/Linear/Vercel as UI precedent for a mockup chrome-frame
  component — not an integration). No Stripe/HitPay SDK, env var, or
  webhook route exists anywhere in `src/`. Still deliberately deferred per
  the same sequencing as T2; the 2026-07-18 ACRA-registration note in the
  07-17 doc is a business-side claim this repo can't verify one way or
  the other.
- **T4 — Two unpaired early specs predate the plan-file convention.**
  Confirmed unchanged: `docs/superpowers/plans/` still has no
  `2026-07-06-*` file pairing with
  `docs/superpowers/specs/2026-07-06-merqo-home-landing-design.md` or
  `2026-07-06-merqo-kit-stacker-design.md` (earliest plan on disk is
  `2026-07-08-merqo-admin-console-phase1.md`). Both specs remain
  implemented in the live app. Hygiene-only, no action needed — carried
  forward as-is.

## Superseded / obsolete

- None. All four 07-17 items still map onto real, distinct current
  state — nothing in this registry has been made moot by other work.

## Flagged, not fixed here (out of scope for a docs/meta-only refresh)

- `AGENTS.md` line 15 ("`qkit`, `loopkit`, and `paykit` are live") is now
  stale: `src/lib/kits.ts` shows `stockkit` as `status: "live"` too (see
  `feat: flip stockkit to live in the kit family config` (#31) and the
  08-15 `ecosystem.ts` drift fix (#45), which fixed the landing page but
  not this doc line). Not one of this registry's T1-T4 items and
  `AGENTS.md` edits are governance-gated, so left for a separate,
  deliberate change rather than folded into this docs-only PR.

## Cross-kit note (carried forward, still accurate)

Unlike qkit/loopkit/paykit/stockkit, merqo hub coordinates _other_ kits
rather than serving customers directly — its remaining open items (T2,
T3) are gated on ecosystem-level decisions (when to start charging
vendors) rather than engineering readiness. The engineering is done; the
business decisions aren't.
