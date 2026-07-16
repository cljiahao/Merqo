# Cross-Kit Order-to-Stamp Wiring — Verification & Reconciliation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm the already-shipped qkit-order-completed → loopkit-stamp-award
feature is actually live in production, and correct the one stale piece of
documentation (`docs/business/2026-07-12-merqo-roadmap.md`'s architecture
section) that still describes a design that was superseded before it was
ever built.

**Architecture:** N/A — this plan builds nothing. The feature (merqo's
`kit_events` signal table, qkit's completion trigger + status-page link,
loopkit's config/claim flow) is fully implemented and committed per
`docs/superpowers/specs/2026-07-16-cross-kit-order-to-stamp-wiring-design.md`
§2. This plan is ops verification (is it actually deployed?) plus a single
markdown documentation correction.

**Tech Stack:** Supabase CLI (`supabase migration list`), Vercel dashboard
(env var check), markdown. No application code, no new migrations — both
explicitly out of scope per the design doc.

## Global Constraints

- No application code changes. No new Supabase migration files. This plan
  only runs verification commands and edits markdown documentation.
- Every finding gets written down in this plan's task output (or a linked
  note) — "looks fine" without evidence is not an acceptable task result,
  per the spec's evidence-based ground-truth approach.
- Task 3's documentation edit lives in `docs/business/2026-07-12-merqo-roadmap.md`,
  **not** any of the three kit repos — that file is outside all three git
  repos (per the 2026-07-13 plan's own note: "that folder is not a git repo,
  nothing there gets committed"). No commit step applies to Task 3; save the
  file directly.
- Reference spec: `docs/superpowers/specs/2026-07-16-cross-kit-order-to-stamp-wiring-design.md`
  (§2 for the full shipped-artifact list with commit hashes, §3 for why each
  task below exists, §5 for the open questions Task 4 records).

---

## Task 1: Verify live Supabase deploy status

**Files:** None modified. Produces a verification record (append findings to
this plan file's checkbox line, or a scratch note — no new file required).

**Interfaces:**

- Consumes: `merqo/supabase/migrations/0008_kit_events.sql`,
  `qkit/supabase/migrations/0051_emit_order_completed.sql`,
  `loopkit/supabase/migrations/0019_qkit_earn.sql`,
  `loopkit/supabase/migrations/0020_qkit_earn_functions.sql` — all already
  committed (spec §2.1); this task only confirms they are _applied_ to the
  live shared Supabase project, not just present in each repo's migrations
  folder.
- Produces: a pass/fail record per migration + the env var check, consumed
  by this plan's completion criteria (no downstream task depends on it).

- [ ] **Step 1: Check merqo's migration is live**

Run from the `merqo` repo root:

```bash
cd merqo && pnpm dlx supabase migration list --linked
```

Expected: `0008_kit_events` appears in the "Remote" column, not only
"Local". If the CLI isn't linked to the project, run
`pnpm dlx supabase link` first per `merqo/docs/DEPLOY.md`'s existing setup
instructions (don't re-derive linking steps — that doc already has them).

- [ ] **Step 2: Check qkit's migration is live**

```bash
cd qkit && pnpm dlx supabase migration list --linked
```

Expected: `0051_emit_order_completed` appears in "Remote".

- [ ] **Step 3: Check loopkit's migrations are live**

```bash
cd loopkit && pnpm dlx supabase migration list --linked
```

Expected: both `0019_qkit_earn` and `0020_qkit_earn_functions` appear in
"Remote".

- [ ] **Step 4: Confirm qkit's `NEXT_PUBLIC_LOOPKIT_URL` env var is set in production**

qkit's own `docs/DEPLOY.md:8-11` flags this as a silent-failure risk: if
unset, `earn-link.tsx` fails closed (per its design — see spec §2.3) and the
claim link simply never renders, with no error surfaced anywhere. Check the
Vercel project settings for qkit's production environment (dashboard →
Project → Settings → Environment Variables) and confirm
`NEXT_PUBLIC_LOOPKIT_URL` is present and points at loopkit's real deployed
URL (not a placeholder or localhost value left over from local dev).

- [ ] **Step 5: Record the outcome**

If any of Steps 1-4 comes back missing/unset, that migration or env var
must be applied/set before Task 2's smoke test can meaningfully pass — note
this as a blocking finding rather than proceeding to Task 2 silently. If all
four are confirmed live, proceed to Task 2.

---

## Task 2: Execute the cross-repo manual smoke test

**Files:** None modified.

**Interfaces:**

- Consumes: the 7-step manual smoke test already fully specified in
  `docs/superpowers/plans/2026-07-13-qkit-loopkit-auto-award.md` Task 10
  Step 2 — reuse those exact steps verbatim, do not re-derive them.
- Produces: a pass/fail record per step, the closest thing this feature has
  to an integration test (no automated cross-repo e2e exists by design —
  spec §6).

- [ ] **Step 1: Re-read the existing smoke test steps**

Open `docs/superpowers/plans/2026-07-13-qkit-loopkit-auto-award.md` and read
Task 10 Step 2 in full (the 7 numbered checks, from "enable 'Earn from qkit
orders' on loopkit's dashboard" through "confirm the new card appears with
1 stamp"). Do not modify that file — it's a historical plan for an already
-completed feature; this task only executes what it already documents.

- [ ] **Step 2: Run the smoke test against the live deployed apps**

With Task 1 confirming all migrations/env vars are live, walk through the 7
checks from that plan against the real deployed qkit and loopkit apps (or
both running locally via `pnpm dev` against the shared Supabase project, if
a real vendor+booth test fixture is more convenient than production data —
match whatever the 2026-07-13 plan's own wording allows, it explicitly
permits either).

- [ ] **Step 3: Record pass/fail per check**

For each of the 7 checks, record pass or fail plus any deviation observed
(e.g., a stale program list, a slow config-endpoint response, a CORS
error). If every check passes, this task confirms the feature genuinely
works end-to-end in production, not just in unit tests. If any check fails,
that failure is a new, real bug — file it as a follow-up, do not attempt to
fix it inline as part of this verification-only plan (fixing it means
writing application code, which is out of this plan's scope per the Global
Constraints).

---

## Task 3: Reconcile the roadmap doc's architecture section

**Files:**

- Modify: `docs/business/2026-07-12-merqo-roadmap.md` (the "Architecture:
  Cross-Kit Data Flow" section, currently lines 128-151 as of this plan's
  writing — confirm the exact line range hasn't shifted before editing,
  since other roadmap edits may have landed since 2026-07-16).

**Interfaces:**

- Consumes: spec §2.2 (why the shipped design diverges), §2.1 (the actual
  table/function names), §4 (endpoint naming correction).
- Produces: an updated roadmap doc section — no downstream task in this
  plan depends on its exact wording, but future cross-kit design work
  (shopkit→paykit, a future stockkit/reachkit integration) should read this
  corrected version rather than the stale one.

- [ ] **Step 1: Read the current section**

Read `docs/business/2026-07-12-merqo-roadmap.md`, section "Architecture:
Cross-Kit Data Flow" (search for that exact heading — do not assume the
line numbers above are still accurate). Confirm it still reads as quoted in
the original research (table name `merqo.metrics`, Edge-Function-fires
description, the three bullet "Rules" at the end).

- [ ] **Step 2: Replace the section**

Replace the full "Architecture: Cross-Kit Data Flow" section (heading
through its closing "Rules" bullets) with:

```markdown
## Architecture: Cross-Kit Data Flow

Free tier: kits standalone. No cross-kit automation.

**Established pattern (shipped 2026-07-13/14, qkit → loopkit):** a thin
shared signal table, `merqo.kit_events` (vendor_id, kit_name, event_type,
event_data, created_at) — not a merged database, each kit still owns 100%
of its domain data in its own schema. A kit writes a pointer via
`merqo.emit_metric()`; any other kit reads it **directly, cross-schema,
from inside its own `SECURITY DEFINER` Postgres function** (never via a
client-side Supabase call, never over HTTP) — qkit, loopkit, and merqo
already share one Postgres project, so this avoids re-inventing
verification/signing machinery a same-DB read gets for free. This is the
right fit whenever the "reaction" is a request-time decision a page needs
to make (e.g. "should this order-status page show a claim link right
now?") — see
`docs/superpowers/specs/2026-07-13-qkit-loopkit-auto-award-design.md` for
the full worked example and the rejected HTTP/Edge-Function alternative
(§3 of that doc).
```

qkit order completed
-> merqo.emit_metric('qkit', 'order_completed', {vendor_id, order_id})
writes a row to merqo.kit_events
-> loopkit's order-status-page claim link calls loopkit's own
GET /api/merqo/qkit-earn-config to decide whether to render
-> customer claims -> loopkit reads merqo.kit_events directly (same
Postgres project, inside a SECURITY DEFINER function) to verify the
order, then awards the stamp in loopkit's own schema

```

**Reserved for future work — not yet needed:** a Supabase Edge Function
triggered on `merqo.kit_events` inserts, dispatching automatically to
reacting kits without any customer action or page load in the loop (e.g. a
future stockkit auto-decrementing ingredient stock, or reachkit
auto-adding a contact). Unlike the qkit→loopkit case, those reactions have
no natural request-time entry point to piggyback on — an Edge Function (or
equivalent async trigger) is the right tool specifically for that shape of
problem. Design this when stockkit/reachkit are actually scoped, using the
qkit→loopkit integration as the precedent for auth conventions and
idempotency (`*_events` tables keyed on the source event's natural ID), not
assuming the two are interchangeable.

Rules:
- Kits never query each other's schemas directly from application/client
  code. Only `merqo.kit_events` (read/written via `SECURITY DEFINER`
  Postgres functions) or each kit's own HTTP API.
- Each kit exposes its own metrics/health endpoints — shipped naming is
  `GET /api/merqo/metrics` (push-style pull target for merqo's dashboard)
  and `GET /api/merqo/vendor-status` (health), used by both qkit and
  loopkit today. (Earlier drafts of this doc referred to `/api/kit/metrics`
  and `/api/kit/status` — corrected here to match what's actually shipped.)
- `merqo.kit_events` is the single source of truth for cross-kit signals
  that another kit needs to read/verify. `merqo.products.metrics_secret`
  remains the auth mechanism for the separate merqo-dashboard pull path
  (`merqo/src/lib/metrics-client.ts`) — a different, unrelated flow from
  the kit_events signal log.
```

- [ ] **Step 3: Save the file**

No git commit step applies — `docs/business/` sits outside all three kit
git repos (confirmed in the 2026-07-13 plan's own constraints section:
"that folder is not a git repo, nothing there gets committed"). Saving the
file directly completes this step.

- [ ] **Step 4: Spot-check no other roadmap section references the old names**

Search the same file for `merqo.metrics` and `/api/kit/` to confirm no
other section (e.g. the 8-Week Build Plan's Week 7 notes) still references
the superseded names in a way that now contradicts the corrected
architecture section. If found, apply the same correction inline (table
name → `merqo.kit_events`, endpoint names → `/api/merqo/metrics` +
`/api/merqo/vendor-status`).

---

## Task 4: Record the open questions as explicitly deferred

**Files:**

- Modify: `docs/superpowers/specs/2026-07-16-cross-kit-order-to-stamp-wiring-design.md`
  is already the record (§5) — this task does not re-litigate or resolve
  those questions, it only confirms they remain visible for whoever picks
  up cross-kit work next, without expanding scope now.

**Interfaces:**

- Consumes: spec §5 (the three open questions).
- Produces: nothing new — this is a "confirm and stop" task, not a design
  or build task. Its only real output is making sure a reader of this plan
  doesn't mistake "not actioned" for "forgotten."

- [ ] **Step 1: Re-read spec §5**

Confirm the three open questions are still accurately stated against
current code before closing this plan out:

1. Whether `/api/merqo/*` bearer auth should eventually migrate to
   paykit's `kit_api_keys` (per-kit, revocable, hashed-secret) pattern —
   deferred until a 4th/5th kit needs a new `/api/merqo/*` endpoint.
2. Whether the page-load-only failure mode in `earn-link.tsx` (claim link
   never resurfaces if loopkit was down at the one moment it was checked)
   is worth fixing — deferred unless it becomes a real vendor complaint.
3. Whether stockkit/reachkit's future automatic reactions should reuse
   `merqo.kit_events` or need a genuine Edge Function — deferred until
   those kits are actually scoped (no repos exist for either today).

- [ ] **Step 2: Confirm no scope creep occurred**

Verify this plan's Tasks 1-3 did not accidentally start building a fix for
any of the three items above (e.g. Task 1's verification pass should not
have turned into a `kit_api_keys` migration for loopkit). If Tasks 1-3
stayed within ops-verification and the single markdown edit, this plan is
complete — no further action, no code, no new migrations.

- [ ] **Step 3: Close out**

This plan has no commit step of its own beyond Task 3's file save — Tasks
1, 2, and 4 produce records/decisions, not commits. The plan is done when
Task 1's verification record is complete, Task 2's 7-point smoke test
record is complete, and Task 3's roadmap doc edit is saved.
