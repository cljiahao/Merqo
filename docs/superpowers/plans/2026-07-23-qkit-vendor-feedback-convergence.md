# qkit Vendor Feedback Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge qkit's vendor-sourced feedback (`qkit.feedback` rows with
`source = 'vendor'`, already a 0-10 NPS score) into the already-shipped
`merqo.vendor_feedback` table, leaving customer-sourced feedback (1-5 star
ordering-experience ratings) completely untouched.

**Architecture:** `qkit.submit_feedback(...)`'s vendor branch calls
`merqo.submit_vendor_feedback('qkit', p_nps, v_message)` directly (a guarded
cross-schema `plpgsql` function call) instead of inserting locally. A
one-time guarded backfill migration copies existing local vendor rows into
`merqo.vendor_feedback`. qkit's own admin page's "Vendor NPS" section
switches from reading local rows to reading `merqo.vendor_feedback`
(`kit_slug = 'qkit'`) via qkit's existing service-role client.

**Tech Stack:** Next.js · Supabase (Postgres, `SECURITY DEFINER` functions,
cross-schema calls) · Zod · Vitest · pgTAP · TypeScript strict, in the
`qkit` repo only (no merqo-repo dependency — `merqo.vendor_feedback` and
`merqo.submit_vendor_feedback` already exist and are already live).

## Global Constraints

- Full design: `docs/superpowers/specs/2026-07-23-qkit-vendor-feedback-convergence-design.md`
  (merqo repo). Read it before starting if anything below is ambiguous.
- New migration file: `supabase/migrations/0071_vendor_feedback_convergence.sql`
  (0070 is qkit's latest existing migration).
- `merqo.submit_vendor_feedback(p_kit_slug text, p_nps int, p_message text)`
  already exists and is already live — this plan calls it, never redefines it.
- **Branch protection is active on the qkit repo** — no direct push to
  `main`. Land via a feature branch, a PR, passing required CI checks, then
  `gh pr merge --squash --delete-branch`.
- qkit source uses double quotes.
- Comment hygiene: own-line comments only, no change-narration (per qkit's
  own AGENTS.md `no-inline-comments: error` cherry-pick).
- Run `pnpm check` and `pnpm test` before every commit.

---

## Task 1: Converge `submit_feedback`'s vendor branch + backfill

**Files:**

- Create: `supabase/migrations/0071_vendor_feedback_convergence.sql`
- Modify: `supabase/tests/rls.test.sql`

**Interfaces:**

- Consumes: `merqo.submit_vendor_feedback(p_kit_slug text, p_nps int,
p_message text)` (already live).
- Produces: `qkit.submit_feedback(...)`'s public signature is unchanged
  (same params, same `RETURNS void`) — every existing caller (the
  `submitFeedback` action, the pgTAP customer-path tests) keeps working
  with zero changes on their end.

- [ ] **Step 1: Write the migration**

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
    v_vendor := auth.uid();

    IF EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'merqo' AND routine_name = 'submit_vendor_feedback'
    ) THEN
      PERFORM merqo.submit_vendor_feedback('qkit', p_nps, v_message);
    END IF;

    RETURN;
  END IF;

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

REVOKE ALL ON FUNCTION qkit.submit_feedback(text, uuid, text, int, int, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qkit.submit_feedback(text, uuid, text, int, int, text, uuid) TO anon, authenticated;

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

- [ ] **Step 2: Add a pgTAP test confirming the vendor path no longer writes locally**

In `supabase/tests/rls.test.sql`, immediately after the existing
`submit_feedback` block (after the line `1, 'submit_feedback wrote exactly
one feedback row');`, add:

```sql
-- submit_feedback('vendor', ...): converged to merqo.vendor_feedback (see
-- docs/superpowers/specs/2026-07-23-qkit-vendor-feedback-convergence-design.md).
-- qkit's own CI has no merqo schema, so the guarded cross-schema call
-- short-circuits — confirm the function still succeeds and, critically, no
-- longer writes a local qkit.feedback row for the vendor path.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text,
  true);
select lives_ok(
  $$ select qkit.submit_feedback('vendor', null, null, null, 9, 'Love qkit!') $$,
  'submit_feedback accepts a vendor NPS submission');
reset role;
select is(
  (select count(*)::int from qkit.feedback where source = 'vendor'),
  0, 'submit_feedback no longer writes a local row for the vendor path');
```

- [ ] **Step 3: Run the pgTAP suite**

Run: `supabase test db`
Expected: all existing tests still pass, plus the two new assertions
(`submit_feedback accepts a vendor NPS submission`,
`submit_feedback no longer writes a local row for the vendor path`).

- [ ] **Step 4: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/qkit-vendor-feedback-convergence
git add supabase/migrations/0071_vendor_feedback_convergence.sql supabase/tests/rls.test.sql
git commit -m "feat: converge qkit vendor feedback into merqo.vendor_feedback"
```

---

## Task 2: Switch the admin page's Vendor NPS section to `merqo.vendor_feedback`

**Files:**

- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/page.test.tsx` (if it exists — check first; if not,
  this task adds no new test file, matching the "no test for this
  particular page" convention already established for merqo's own admin
  feedback page)

**Interfaces:**

- Consumes: `merqo.vendor_feedback` (columns `nps`, `message`,
  `created_at`), read via the existing `createServiceClient()` cast to
  reach the `merqo` schema.

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/app/admin/page.test.tsx 2>&1` (or the platform equivalent). If
it exists, read it in full before editing — Step 3 below must keep it
passing. If it doesn't exist, skip straight to Step 2 (no test file to
create for this page, matching the established convention that this class
of admin aggregate page has no dedicated render test in this codebase).

- [ ] **Step 2: Locate the current vendor-NPS block**

In `src/app/admin/page.tsx`, find:

```ts
const vendorRows = all.filter((f) => f.source === "vendor");
const nps = npsBreakdown(
  vendorRows.map((f) => f.nps).filter((n): n is number => n != null),
);
const npsComments = vendorRows.filter((f) => f.message?.trim());
```

- [ ] **Step 3: Replace it with a `merqo.vendor_feedback` read**

Replace the three lines above with:

```ts
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

Add the two new imports this needs, alongside the file's existing imports:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
```

(If `Database` is already imported in this file for another purpose, don't
duplicate the import — just reuse it.)

The rest of the page (the customer-CSAT block, the per-vendor-CSAT block,
the JSX rendering `nps`/`npsComments`) is unchanged — `nps` and
`npsComments` keep the exact same shape (`NpsBreakdown` /
`{message, nps, created_at}[]`-ish) the existing JSX already consumes.

- [ ] **Step 4: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS. If a test file for this page exists and asserted on the old
local-row query shape, update its mock to intercept
`.schema("merqo").from("vendor_feedback")` instead of the local
`.from("feedback")` filter — mirror whatever mocking convention that test
file already uses for the page's other queries.

- [ ] **Step 5: Commit, push, open PR, merge**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: read qkit's admin vendor-NPS section from merqo.vendor_feedback"
git push -u origin feat/qkit-vendor-feedback-convergence
gh pr create --title "feat: converge qkit vendor feedback into merqo.vendor_feedback" --body "Converts qkit.submit_feedback's vendor branch to call merqo.submit_vendor_feedback directly, backfills existing local vendor rows, and switches the admin page's Vendor NPS section to read from the shared table. Customer feedback is untouched. See merqo/docs/superpowers/specs/2026-07-23-qkit-vendor-feedback-convergence-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Self-Review

**1. Spec coverage:** every guiding decision in the design spec maps to a
task — DB-level composition + guard (Task 1), backfill (Task 1), admin-page
read-side swap (Task 2). Customer feedback is untouched by both tasks,
matching the spec's explicit scope boundary.

**2. Placeholder scan:** no TBD/TODO; both tasks show complete code.

**3. Type consistency:** `merqo.submit_vendor_feedback`'s call signature
(`'qkit', p_nps, v_message`) matches the function's real, already-shipped
signature (`p_kit_slug text, p_nps int, p_message text`) exactly. The admin
page's `.eq("kit_slug", "qkit")` filter matches the `kit_slug` value the
migration's backfill and the RPC call both use — a future reader can't find
a mismatch between what's written and what's read.
