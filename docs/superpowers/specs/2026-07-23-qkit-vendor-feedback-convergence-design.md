# qkit Vendor Feedback Convergence — Design

**Date:** 2026-07-23
**Status:** Approved (design); plan to follow.
**Scope:** qkit only. Extends
`docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md`
(loopkit/stockkit/paykit, already shipped) to the one kit that spec
explicitly excluded.

## Summary

qkit's `feedback` table conflates two audiences under one `source` column:
`source='customer'` (an anonymous, order-token-verified 1-5 star rating of
the ordering experience) and `source='vendor'` (a signed-in vendor's 0-10
NPS score for qkit itself, `nps` column added in migration
`0019_feedback_nps_and_vendor_read.sql`). The original vendor-feedback spec
excluded qkit entirely on the assumption its whole `feedback` table had an
incompatible shape; closer reading shows only the customer half does —
qkit's vendor half is already byte-identical in concept and scale to what
loopkit/stockkit/paykit already converged.

This spec converges **only** the vendor half into the already-shipped
`merqo.vendor_feedback` table. Customer feedback (the 1-5 star ordering
experience rating, `Platform CSAT`/`Satisfaction by vendor` admin sections)
is untouched, stays local to qkit, and never touches `merqo.*` — matching
the standing rule that only kit/vendor-relevant product feedback belongs in
the shared schema, not per-order customer data.

### Guiding decisions (locked during brainstorming)

- **DB-level composition, not an app-level wrapper.** Unlike the other three
  kits, qkit already routes both feedback audiences through one Postgres
  function, `qkit.submit_feedback(...)` (`SECURITY DEFINER`, branches on
  `p_source`). Duplicating that branch in TypeScript would create two
  divergent copies of the same decision. Instead, `submit_feedback`'s own
  vendor branch calls `merqo.submit_vendor_feedback('qkit', p_nps,
v_message)` directly — a guarded cross-schema function call, no app code
  changes. This is the first cross-kit convergence this session done at the
  SQL-function level rather than the TypeScript-action level; every prior
  one (loopkit, stockkit, paykit, qkit's own future support-message
  convergence) has an app-layer branch point to hook into, qkit's feedback
  path does not.
- **Vendor rows stop being inserted locally, going forward.** Once the
  vendor branch calls `merqo.submit_vendor_feedback`, it no longer also
  writes to `qkit.feedback` — single source of truth after cutover, no
  dual-write to keep in sync. Existing historical vendor rows are backfilled
  (see below) so nothing is lost; the local `feedback` table keeps existing
  (customer rows still write there) but stops growing its `vendor` slice.
- **Read side follows the already-written admin-data-convergence standard.**
  qkit's own admin page already shows a "Vendor NPS" hero section reading
  local vendor rows — per
  `docs/business/2026-07-23-admin-data-convergence-standard.md`'s §4, a
  kit's own admin page that already shows converging data keeps showing it,
  reading its own slice of the shared table via its own service-role client,
  gated by its own existing app-level admin check (`requireAdmin()`), not
  through `merqo.is_merqo_team`-gated RLS (a qkit admin isn't a merqo-team
  member). The `Platform CSAT`/`Satisfaction by vendor` sections (customer
  data) are untouched.
- **CI guard, matching precedent.** qkit's own local `supabase start` builds
  a fresh Postgres from only qkit's migrations — no `merqo` schema exists
  there. The cross-schema function call inside `submit_feedback` is guarded
  by an `information_schema.routines` existence check (same pattern the
  backfill migrations already use `information_schema.tables` for). qkit's
  own pgTAP suite only ever calls `submit_feedback('customer', ...)` in
  practice (confirmed by reading `supabase/tests/rls.test.sql`), so this
  guard is defensive, not currently load-bearing for CI — but it's cheap and
  matches the codebase's established convention for any real deploy where a
  local-only dev database might not have `merqo` provisioned either.

## What changes — qkit repo

### `supabase/migrations/0071_vendor_feedback_convergence.sql` (new)

Two parts: replace `submit_feedback` (adds the guarded cross-schema call,
skips the local insert for `source='vendor'`), and a guarded backfill of
existing local vendor rows.

```sql
-- Converge qkit's vendor-sourced feedback (source='vendor') into the shared
-- merqo.vendor_feedback table (merqo migration 0011) — the same 0-10 NPS
-- concept loopkit/stockkit/paykit already converged. Customer-sourced rows
-- (1-5 star ordering-experience ratings) are untouched, stay local. See
-- docs/superpowers/specs/2026-07-23-qkit-vendor-feedback-convergence-design.md

CREATE OR REPLACE FUNCTION qkit.submit_feedback(
  p_source       text,
  p_booth_id     uuid    DEFAULT NULL,
  p_order_number text    DEFAULT NULL,
  p_rating       int     DEFAULT NULL,
  p_nps          int     DEFAULT NULL,
  p_message      text    DEFAULT NULL,
  p_access_token uuid    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = qkit
AS $$
DECLARE
  v_vendor  uuid := NULL;
  v_message text;
BEGIN
  IF p_source NOT IN ('customer', 'vendor') THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: source';
  END IF;

  v_message := NULLIF(btrim(COALESCE(p_message, '')), '');
  IF v_message IS NOT NULL AND char_length(v_message) > 2000 THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: message too long';
  END IF;
  IF p_order_number IS NOT NULL AND char_length(p_order_number) > 40 THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: order number';
  END IF;
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: rating';
  END IF;
  IF p_nps IS NOT NULL AND (p_nps < 0 OR p_nps > 10) THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: nps';
  END IF;
  IF p_rating IS NULL AND p_nps IS NULL AND v_message IS NULL THEN
    RAISE EXCEPTION 'FEEDBACK_INVALID: empty';
  END IF;

  IF p_source = 'vendor' THEN
    -- vendor_id comes from the caller's own JWT, never a param.
    v_vendor := auth.uid();

    -- Guarded: qkit's own CI/local supabase start has no merqo schema at
    -- all. Real environments apply merqo's migrations first, so this
    -- resolves true there; this only short-circuits when it's genuinely
    -- absent (same guard pattern as the vendor_feedback backfill
    -- migrations in loopkit/stockkit/paykit).
    IF EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'merqo' AND routine_name = 'submit_vendor_feedback'
    ) THEN
      PERFORM merqo.submit_vendor_feedback('qkit', p_nps, v_message);
    END IF;

    RETURN;
  END IF;

  -- Customer: prove the reviewer actually holds this order's access token.
  IF p_booth_id IS NULL
     OR p_order_number IS NULL
     OR p_access_token IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM qkit.orders
       WHERE booth_id = p_booth_id
         AND order_number = p_order_number
         AND access_token = p_access_token
     )
  THEN
    RAISE EXCEPTION 'FEEDBACK_UNAUTHORIZED: order proof required';
  END IF;

  INSERT INTO qkit.feedback
    (source, vendor_id, booth_id, order_number, rating, message)
  VALUES
    (p_source, NULL, p_booth_id, NULLIF(p_order_number, ''), p_rating, v_message);
END;
$$;

-- One-time, guarded backfill of qkit's existing local vendor rows into the
-- shared table. Guarded the same way (no merqo schema in qkit's own
-- isolated CI Postgres). Idempotent via NOT EXISTS (no natural key survives
-- the copy) — same pattern the other three kits' backfills already use.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'merqo' AND table_name = 'vendor_feedback'
  ) THEN
    INSERT INTO merqo.vendor_feedback (kit_slug, vendor_id, nps, message, created_at)
    SELECT 'qkit', vendor_id, nps, message, created_at
    FROM qkit.feedback f
    WHERE f.source = 'vendor'
      AND f.vendor_id IS NOT NULL
      AND f.nps IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM merqo.vendor_feedback vf
        WHERE vf.kit_slug = 'qkit'
          AND vf.vendor_id = f.vendor_id
          AND vf.created_at = f.created_at
      );
  END IF;
END $$;
```

No changes to the `qkit.feedback` table's columns or RLS policies — the
`feedback_public_insert`/`feedback_admin_select`/`feedback_vendor_read_own`
policies are all still needed for the customer path, which is unchanged.

### `src/app/admin/page.tsx`

Replace the local-vendor-rows NPS computation with a `merqo.vendor_feedback`
read, filtered to `kit_slug = 'qkit'`, via the existing service-role client
this page already uses (`createServiceClient()`, scoped to schema `"qkit"`
by default — cast to reach `merqo` for this one query, same
`as unknown as SupabaseClient<...>` technique every other kit's
`merqo-*.ts` wrapper already uses).

```tsx
const merqoClient = supabase as unknown as SupabaseClient<Database>;
const { data: vendorFeedbackRows } = await merqoClient
  .schema("merqo")
  .from("vendor_feedback")
  .select("nps, message, created_at")
  .eq("kit_slug", "qkit")
  .order("created_at", { ascending: false })
  .limit(200);
const vendorFeedback = vendorFeedbackRows ?? [];
const nps = npsBreakdown(vendorFeedback.map((f) => f.nps));
const npsComments = vendorFeedback.filter((f) => f.message?.trim());
```

This replaces the current `vendorRows`/`nps`/`npsComments` block (today
derived from the local `feedback` query's `source === "vendor"` filter).
The local `feedback` query itself keeps running unchanged for the customer
side (`all.filter((f) => f.source === "customer")` for CSAT) — only the
vendor-NPS half of the page's data source moves. Because the backfill
migration copies every historical vendor row into `merqo.vendor_feedback`
before this code ships, the page's "Vendor NPS" section shows the same full
history post-cutover, not just new rows.

## Error handling

- `submit_feedback`'s vendor branch behaves identically to today from the
  caller's perspective — same validation, same exceptions, same `RETURNS
void`. The only difference invisible to any existing caller is where the
  row physically lands.
- If `merqo.submit_vendor_feedback` itself raises (e.g. a constraint
  violation), that exception propagates up through `qkit.submit_feedback`
  the same way any other exception in this function already does — the
  calling `submitFeedback` action's existing `catch`/error-mapping in
  `src/app/actions/feedback.ts` requires no changes.
- The admin page's new `merqo.vendor_feedback` query has no distinct
  error-surfacing requirement beyond what the existing page already does
  for its other queries (best-effort `?? []` fallback) — this is an admin
  dashboard read, not a user-facing form.

## Testing

- **qkit**: pgTAP test extending `supabase/tests/rls.test.sql` (or a new
  focused file) — confirms `submit_feedback('vendor', ...)` no longer
  inserts into `qkit.feedback` (row count unchanged after the call), and
  that `submit_feedback('customer', ...)` behavior is completely unchanged
  (existing tests already cover this, re-run to confirm no regression). A
  vitest-mocked-SQL-text test (mirroring
  `test/db/vendor-feedback-schema.test.ts`'s convention in merqo) is not
  applicable here since this is a function edit, not a fresh migration with
  fixed expected DDL — the pgTAP behavioral test is the right tool.
- **qkit admin page**: existing test coverage for `admin/page.tsx` (if any)
  gets its vendor-NPS assertions updated to mock the new `merqo.vendor_feedback`
  query instead of filtering local rows; the customer-CSAT assertions are
  unchanged.

## Sequencing

No new merqo-side schema is needed — `merqo.vendor_feedback` and
`merqo.submit_vendor_feedback` already exist and are already live (shipped
this session). This migration can ship independently, in qkit's own repo,
with no merqo-repo dependency to wait on.

## Self-review

- No placeholders/TBDs.
- Internally consistent: the guarded `PERFORM merqo.submit_vendor_feedback(...)`
  call matches that function's real signature
  (`p_kit_slug text, p_nps int, p_message text`) exactly.
- Scope: qkit's vendor-feedback half only — explicitly excludes qkit's
  customer feedback (different concept, stays local) and qkit's
  support/get-help convergence (separate spec,
  `2026-07-23-cross-kit-support-messages-remaining-kits-design.md`).
- Ambiguity check: "stop inserting locally, going forward" is stated
  explicitly as a one-way cutover, not a dual-write — a future reader
  won't wonder why local vendor rows stop appearing after this ships.
