# Cross-Kit Vendor Feedback / NPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge loopkit/stockkit/paykit's identical local vendor NPS/feedback
tables into one shared `merqo.vendor_feedback` table, so Merqo's admin page
shows vendor feedback broken down per kit, while each kit's own vendor-facing
"leave feedback" flow keeps working unchanged.

**Architecture:** A new `merqo.vendor_feedback` table, written only through a
`SECURITY DEFINER` RPC (`merqo.submit_vendor_feedback`) that reads `auth.uid()`
internally, read only by Merqo's own admin page via an RLS team-select policy.
Each of loopkit/stockkit/paykit gets a one-time backfill migration copying its
existing local rows across, then swaps its `submitFeedbackAction`'s local
insert for a call through a small generic RPC wrapper.

**Tech Stack:** Next.js 16 · Supabase (Postgres, RLS, `SECURITY DEFINER`
functions) · Zod · Vitest · TypeScript strict, across 4 repos: `merqo`,
`loopkit`, `stockkit`, `paykit`.

## Global Constraints

- Full design: `docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md`
  (this repo, merqo). Read it before starting if anything below is ambiguous.
- New merqo migration file: `supabase/migrations/0011_vendor_feedback.sql`
  (0010 is the latest existing one).
- New backfill migration files, one per kit: loopkit
  `supabase/migrations/0030_vendor_feedback_backfill.sql` (0029 is latest),
  stockkit `supabase/migrations/0005_vendor_feedback_backfill.sql` (0004 is
  latest), paykit `supabase/migrations/0004_vendor_feedback_backfill.sql`
  (0003 is latest).
- The RPC is `merqo.submit_vendor_feedback(p_kit_slug text, p_nps int,
p_message text)` — every wrapper/call site must use these exact parameter
  names and order.
- **Merqo's migration (Task 1) must be merged to `main` in the merqo repo
  before any kit's backfill/code-swap tasks (Tasks 5-10) are merged** — same
  cross-repo ordering rule as `vendor_profile`/`support_messages`. There is no
  live shared Postgres instance in this environment (confirmed in the
  `support_messages` plan before this one), so this is a merge-order rule for
  humans/CI to respect at real deploy time, not something enforced by a test
  here.
- **Branch protection is active on all 4 repos** (merqo, loopkit, stockkit,
  paykit) — no direct push to `main` is possible for anyone. Every task's
  commits land via a feature branch, a PR, passing required CI checks, then
  `gh pr merge --squash --delete-branch`. Group tasks into PRs by repo: one PR
  for Tasks 1-4 (merqo), one for Tasks 5-6 (loopkit), one for Tasks 7-8
  (stockkit), one for Tasks 9-10 (paykit) — merge the merqo PR first per the
  ordering rule above.
- Quote style: merqo, loopkit, and paykit source uses double quotes; stockkit
  source uses single quotes (its existing `src/app/actions/feedback.ts` and
  `src/components/feedback-form.dom.test.tsx` are both single-quoted — match
  that file's own style, don't reformat the whole repo).
- Comment hygiene: no inline/trailing comments in stockkit (`no-inline-comments:
error`) or merqo (`no-inline-comments: warn`) — own-line comments only, and
  no change-narration ("added", "was X", dates) in any repo's comments per
  each repo's own AGENTS.md.
- Run each repo's own `pnpm check` (prettier --check + eslint + tsc --noEmit)
  and `pnpm test` before every commit in that repo.

---

## Task 1: `merqo.vendor_feedback` table, RPC, and migration schema test

**Files:**

- Create: `supabase/migrations/0011_vendor_feedback.sql`
- Create: `test/db/vendor-feedback-schema.test.ts`

**Interfaces:**

- Produces: table `merqo.vendor_feedback` (`id uuid`, `kit_slug text`,
  `vendor_id uuid`, `nps int`, `message text`, `created_at timestamptz`);
  function `merqo.submit_vendor_feedback(p_kit_slug text, p_nps int,
p_message text) returns merqo.vendor_feedback`. Every later task in this
  plan calls this function by this exact name and argument list.

- [ ] **Step 1: Write the migration**

```sql
-- Shared vendor NPS/feedback, converged from loopkit/stockkit/paykit's own
-- identical local `feedback` tables (vendor_id, nps 0-10, message,
-- created_at). Distinct from merqo.feedback (0007) — that table is Merqo
-- hub's own NPS about Merqo itself, unrelated to this one. See
-- docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md

create table merqo.vendor_feedback (
  id          uuid primary key default gen_random_uuid(),
  kit_slug    text not null references merqo.products(slug),
  vendor_id   uuid not null references auth.users(id) on delete cascade,
  nps         int  not null check (nps between 0 and 10),
  message     text check (message is null or char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);

create index vendor_feedback_kit_created_idx
  on merqo.vendor_feedback (kit_slug, created_at desc);

alter table merqo.vendor_feedback enable row level security;

-- No INSERT policy — writes only go through submit_vendor_feedback below
-- (SECURITY DEFINER bypasses RLS for that path).
create policy vendor_feedback_team_select on merqo.vendor_feedback
  for select using (merqo.is_merqo_team(auth.uid()));

grant select on merqo.vendor_feedback to authenticated;

create or replace function merqo.submit_vendor_feedback(
  p_kit_slug text,
  p_nps int,
  p_message text
) returns merqo.vendor_feedback
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_feedback;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message)
  values (p_kit_slug, auth.uid(), p_nps, nullif(p_message, ''))
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.submit_vendor_feedback(text, int, text)
  to authenticated;
```

- [ ] **Step 2: Write the schema test**

Mirrors `test/db/cross-kit-support-messages-schema.test.ts`'s
read-the-raw-SQL-as-lowercased-text convention exactly.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0011_vendor_feedback.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0011_vendor_feedback migration", () => {
  it("creates vendor_feedback with a NOT NULL kit_slug referencing merqo.products", () => {
    expect(sql).toContain("create table merqo.vendor_feedback");
    expect(sql).toMatch(
      /kit_slug\s+text\s+not null\s+references merqo\.products\(slug\)/,
    );
  });

  it("checks nps is between 0 and 10", () => {
    expect(sql).toMatch(
      /nps\s+int\s+not null\s+check \(nps between 0 and 10\)/,
    );
  });

  it("enables RLS with a team-select policy and no insert policy", () => {
    expect(sql).toContain(
      "alter table merqo.vendor_feedback enable row level security",
    );
    expect(sql).toMatch(
      /create policy vendor_feedback_team_select on merqo\.vendor_feedback\s*\n\s*for select using \(merqo\.is_merqo_team\(auth\.uid\(\)\)\)/,
    );
    expect(sql).not.toMatch(/for insert/);
  });

  it("defines submit_vendor_feedback as security definer with a pinned search_path", () => {
    expect(sql).toMatch(
      /create (or replace )?function merqo\.submit_vendor_feedback/,
    );
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set search_path\s*=\s*''/);
  });

  it("submit_vendor_feedback rejects an unauthenticated caller before writing", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_vendor_feedback",
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = sql.slice(idx);
    expect(body).toMatch(/if auth\.uid\(\) is null then/);
    expect(body).toMatch(/raise exception/);
    expect(body.indexOf("auth.uid() is null")).toBeLessThan(
      body.indexOf("insert into merqo.vendor_feedback"),
    );
  });

  it("submit_vendor_feedback writes auth.uid() as vendor_id, never a passed-in id", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_vendor_feedback",
    );
    const body = sql.slice(idx);
    expect(body).toMatch(
      /insert into merqo\.vendor_feedback \(kit_slug, vendor_id, nps, message\)/,
    );
    expect(body).toMatch(/values \(p_kit_slug, auth\.uid\(\)/);
  });

  it("grants execute to authenticated, not anon", () => {
    expect(sql).toMatch(
      /grant execute on function merqo\.submit_vendor_feedback[^;]*to[^;]*authenticated/,
    );
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*anon/);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm exec vitest run test/db/vendor-feedback-schema.test.ts`
Expected: 6 tests, all PASS.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/cross-kit-vendor-feedback-merqo
git add supabase/migrations/0011_vendor_feedback.sql test/db/vendor-feedback-schema.test.ts
git commit -m "feat: add merqo.vendor_feedback shared table and RPC"
```

---

## Task 2: `groupVendorFeedbackByKit` helper

**Files:**

- Create: `src/lib/vendor-feedback.ts`
- Create: `src/lib/vendor-feedback.test.ts`

**Interfaces:**

- Consumes: nothing (pure function, no I/O).
- Produces: `VendorFeedbackRow` type and `groupVendorFeedbackByKit(rows:
VendorFeedbackRow[]): Map<string, VendorFeedbackRow[]>` — Task 4's page
  imports both.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  groupVendorFeedbackByKit,
  type VendorFeedbackRow,
} from "./vendor-feedback";

function row(overrides: Partial<VendorFeedbackRow>): VendorFeedbackRow {
  return {
    id: "1",
    kit_slug: "loopkit",
    nps: 9,
    message: null,
    created_at: "2026-07-23T00:00:00Z",
    ...overrides,
  };
}

describe("groupVendorFeedbackByKit", () => {
  it("groups rows by kit_slug, preserving each row's order within its group", () => {
    const rows = [
      row({ id: "1", kit_slug: "paykit" }),
      row({ id: "2", kit_slug: "loopkit" }),
      row({ id: "3", kit_slug: "loopkit" }),
    ];
    const grouped = groupVendorFeedbackByKit(rows);
    expect(grouped.get("loopkit")?.map((r) => r.id)).toEqual(["2", "3"]);
    expect(grouped.get("paykit")?.map((r) => r.id)).toEqual(["1"]);
  });

  it("orders kit groups alphabetically regardless of input order", () => {
    const rows = [
      row({ id: "1", kit_slug: "stockkit" }),
      row({ id: "2", kit_slug: "loopkit" }),
      row({ id: "3", kit_slug: "paykit" }),
    ];
    const grouped = groupVendorFeedbackByKit(rows);
    expect([...grouped.keys()]).toEqual(["loopkit", "paykit", "stockkit"]);
  });

  it("returns an empty map for no rows", () => {
    expect(groupVendorFeedbackByKit([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/vendor-feedback.test.ts`
Expected: FAIL with "Cannot find module './vendor-feedback'"

- [ ] **Step 3: Write the implementation**

```ts
export type VendorFeedbackRow = {
  id: string;
  kit_slug: string;
  nps: number;
  message: string | null;
  created_at: string;
};

export function groupVendorFeedbackByKit(
  rows: VendorFeedbackRow[],
): Map<string, VendorFeedbackRow[]> {
  const byKit = new Map<string, VendorFeedbackRow[]>();
  for (const row of rows) {
    const group = byKit.get(row.kit_slug);
    if (group) group.push(row);
    else byKit.set(row.kit_slug, [row]);
  }
  return new Map([...byKit.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/vendor-feedback.test.ts`
Expected: 3 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor-feedback.ts src/lib/vendor-feedback.test.ts
git commit -m "feat: add groupVendorFeedbackByKit helper"
```

---

## Task 3: Extract `NpsCard` component

**Files:**

- Create: `src/components/nps-card.tsx`
- Create: `src/components/nps-card.test.tsx`
- Modify: `src/app/admin/feedback/page.tsx` (extraction only — the hub NPS
  section's inline JSX moves into this component; the per-kit section is
  added in Task 4, not here)

**Interfaces:**

- Consumes: `npsBreakdown` from `@/lib/nps` (existing, unchanged).
- Produces: `NpsCard({ title, scores }: { title: string; scores: number[] })`
  — Task 4 renders one per kit group plus one for the existing hub section.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NpsCard } from "./nps-card";

describe("NpsCard", () => {
  it("shows a dash and zero responses when there are no scores", () => {
    render(<NpsCard title="Test kit" scores={[]} />);
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("0 responses")).toBeInTheDocument();
  });

  it("computes and shows the NPS score for a mix of scores", () => {
    render(<NpsCard title="Test kit" scores={[10, 10, 0]} />);
    expect(screen.getByText("33")).toBeInTheDocument();
    expect(screen.getByText("3 responses")).toBeInTheDocument();
    expect(screen.getByText("1 detractors")).toBeInTheDocument();
  });

  it("shows the given title", () => {
    render(<NpsCard title="loopkit" scores={[9]} />);
    expect(screen.getByText("loopkit")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/nps-card.test.tsx`
Expected: FAIL with "Cannot find module './nps-card'"

- [ ] **Step 3: Write the implementation**

```tsx
import { npsBreakdown } from "@/lib/nps";

export function NpsCard({
  title,
  scores,
}: {
  title: string;
  scores: number[];
}) {
  const nps = npsBreakdown(scores);
  return (
    <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-display text-5xl font-bold">
          {nps.score ?? "-"}
        </span>
        <span className="pb-1 font-mono text-sm text-muted-foreground">
          {nps.total} response{nps.total === 1 ? "" : "s"}
        </span>
      </div>
      {nps.total > 0 && (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {nps.detractors > 0 && (
              <div
                style={{ flexGrow: nps.detractors / nps.total }}
                className="bg-destructive"
              />
            )}
            {nps.passives > 0 && (
              <div
                style={{ flexGrow: nps.passives / nps.total }}
                className="bg-muted-foreground/40"
              />
            )}
            {nps.promoters > 0 && (
              <div
                style={{ flexGrow: nps.promoters / nps.total }}
                className="bg-primary"
              />
            )}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{nps.detractors} detractors</span>
            <span>{nps.passives} passive</span>
            <span>{nps.promoters} promoters</span>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/nps-card.test.tsx`
Expected: 3 tests, all PASS.

- [ ] **Step 5: Replace the hub section's inline JSX in the page with `NpsCard`**

In `src/app/admin/feedback/page.tsx`, add the import:

```ts
import { NpsCard } from "@/components/nps-card";
```

Replace the existing inline `<section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">...</section>` block (lines 37-78 of the current file — the "Vendor NPS · how vendors rate Merqo" card) with:

```tsx
<NpsCard
  title="Vendor NPS · how vendors rate Merqo"
  scores={all.map((f) => f.nps as number)}
/>
```

- [ ] **Step 6: Run the full merqo test suite to confirm nothing broke**

Run: `pnpm test`
Expected: all existing tests still PASS (this page has no existing test file
to update — confirmed by search before writing this plan).

- [ ] **Step 7: Commit**

```bash
git add src/components/nps-card.tsx src/components/nps-card.test.tsx src/app/admin/feedback/page.tsx
git commit -m "refactor: extract NpsCard from admin feedback page"
```

---

## Task 4: Wire up the per-kit vendor feedback section

**Files:**

- Modify: `src/app/admin/feedback/page.tsx`

**Interfaces:**

- Consumes: `groupVendorFeedbackByKit`/`VendorFeedbackRow` from
  `@/lib/vendor-feedback` (Task 2), `NpsCard` from `@/components/nps-card`
  (Task 3).

- [ ] **Step 1: Replace the full file content**

```tsx
import { requireMerqoTeam } from "@/lib/team";
import { createServerClient } from "@/lib/supabase/server";
import { NpsCard } from "@/components/nps-card";
import {
  groupVendorFeedbackByKit,
  type VendorFeedbackRow,
} from "@/lib/vendor-feedback";

export const revalidate = 0;

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default async function AdminFeedbackPage() {
  await requireMerqoTeam();
  const supabase = await createServerClient();

  const { data: rows, error } = await supabase
    .from("feedback")
    .select("id, nps, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  // A query error is a config/grant fault, NOT "no feedback yet" — surface it
  // loudly rather than silently rendering an empty state.
  if (error) throw new Error(`feedback read failed: ${error.message}`);
  const all = rows ?? [];
  const comments = all.filter((f) => (f.message as string | null)?.trim());

  const { data: vendorRows, error: vendorError } = await supabase
    .from("vendor_feedback")
    .select("id, kit_slug, nps, message, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (vendorError)
    throw new Error(`vendor_feedback read failed: ${vendorError.message}`);
  const vendorFeedback = (vendorRows ?? []) as VendorFeedbackRow[];
  const byKit = groupVendorFeedbackByKit(vendorFeedback);
  const vendorComments = vendorFeedback.filter((f) => f.message?.trim());

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Feedback
        </h1>
      </div>

      <NpsCard
        title="Vendor NPS · how vendors rate Merqo"
        scores={all.map((f) => f.nps as number)}
      />

      {comments.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comments
          </h2>
          {comments.map((f) => (
            <div
              key={f.id as string}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  NPS {f.nps as number}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {when(f.created_at as string)}
                </span>
              </div>
              <p className="mt-2 text-sm">{f.message as string}</p>
            </div>
          ))}
        </section>
      )}

      {all.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Vendor feedback by kit
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          NPS submitted by vendors on loopkit, stockkit, and paykit.
        </p>
      </div>

      {byKit.size === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No vendor feedback yet.
        </div>
      ) : (
        [...byKit.entries()].map(([kitSlug, kitRows]) => (
          <NpsCard
            key={kitSlug}
            title={kitSlug}
            scores={kitRows.map((r) => r.nps)}
          />
        ))
      )}

      {vendorComments.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vendor comments
          </h2>
          {vendorComments.map((f) => (
            <div key={f.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {f.kit_slug}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                    NPS {f.nps}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {when(f.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm">{f.message}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS (typecheck, lint, format, and every test file — this page
still has no dedicated test file, per the existing project convention of not
directly rendering-testing this async Server Component; its logic
dependencies `groupVendorFeedbackByKit` and `NpsCard` are unit-tested in
Tasks 2-3).

- [ ] **Step 3: Commit, push, open PR, merge**

```bash
git add src/app/admin/feedback/page.tsx
git commit -m "feat: show vendor feedback by kit on the admin feedback page"
git push -u origin feat/cross-kit-vendor-feedback-merqo
gh pr create --title "feat: cross-kit vendor feedback/NPS convergence (merqo)" --body "Adds merqo.vendor_feedback (shared table + RPC) and a per-kit breakdown on the admin feedback page. See docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md."
```

Wait for required checks (`check + unit`, `build (next build)`, `e2e (public
smoke)`, `db (migrations + pgTAP RLS)`) to pass, then:

```bash
gh pr merge --squash --delete-branch
```

This PR must merge **before** starting Task 5.

---

## Task 5: loopkit backfill migration + RPC wrapper

**Files:**

- Create (loopkit repo): `supabase/migrations/0030_vendor_feedback_backfill.sql`
- Create (loopkit repo): `src/lib/merqo-vendor-feedback.ts`
- Modify (loopkit repo): `src/lib/README.md`

**Interfaces:**

- Consumes: `merqo.submit_vendor_feedback` (Task 1, must already be merged to
  merqo `main`).
- Produces: `submitVendorFeedback<Db, SchemaName>(supabase, kitSlug, nps,
message)` — Task 6 calls this.

- [ ] **Step 1: Write the backfill migration**

```sql
-- One-time copy of existing local feedback rows into the shared
-- merqo.vendor_feedback table (merqo migration 0011). See
-- merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md
insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message, created_at)
select 'loopkit', vendor_id, nps, message, created_at
from loopkit.feedback f
where not exists (
  select 1 from merqo.vendor_feedback vf
  where vf.kit_slug = 'loopkit'
    and vf.vendor_id = f.vendor_id
    and vf.created_at = f.created_at
);
```

- [ ] **Step 2: Write the RPC wrapper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_vendor_feedback RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside loopkit's
 * own supabase gen types scope (schema: "loopkit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md.
 */
type MerqoVendorFeedbackSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_vendor_feedback: {
        Args: { p_kit_slug: string; p_nps: number; p_message: string | null };
        Returns: { id: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Callers pass in a client already scoped to their own (loopkit) Database
 * and schema name — same generic-over-caller's-client pattern as
 * merqo-vendor-profile.ts, for the same reason (a bare SupabaseClient
 * defaults its schema-name param to "public", which a real caller scoped
 * to "loopkit" doesn't structurally match).
 */
export async function submitVendorFeedback<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  kitSlug: string,
  nps: number,
  message: string | null,
): Promise<void> {
  const merqoClient =
    supabase as unknown as SupabaseClient<MerqoVendorFeedbackSchema>;
  const { error } = await merqoClient
    .schema("merqo")
    .rpc("submit_vendor_feedback", {
      p_kit_slug: kitSlug,
      p_nps: nps,
      p_message: message,
    });
  if (error) {
    throw new Error(`submit_vendor_feedback failed: ${error.message}`);
  }
}
```

- [ ] **Step 3: Update `src/lib/README.md`**

Add one bullet, alphabetically placed right after the existing
`merqo-vendor-profile.ts` bullet (after line 28, before the
`merqo-vendor-status.test.ts` bullet on line 29):

```markdown
- `merqo-vendor-feedback.ts` — `submitVendorFeedback`: hand-written mirror of merqo's cross-schema `submit_vendor_feedback` RPC contract, generic over the caller's own `Database`/schema so `"loopkit"`-scoped clients type-check; the write path used by `actions/feedback.ts` in place of a local insert
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`
Expected: PASS (this task adds no test file yet — the wrapper is exercised
indirectly through Task 6's action test, matching how `merqo-support.ts` in
paykit has no standalone test file of its own either).

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/cross-kit-vendor-feedback
git add supabase/migrations/0030_vendor_feedback_backfill.sql src/lib/merqo-vendor-feedback.ts src/lib/README.md
git commit -m "feat: add vendor_feedback backfill migration and RPC wrapper"
```

---

## Task 6: loopkit — swap `submitFeedbackAction` to the shared RPC

**Files:**

- Modify: `src/app/actions/feedback.ts`
- Modify: `src/app/actions/feedback.test.ts`

**Interfaces:**

- Consumes: `submitVendorFeedback` from `@/lib/merqo-vendor-feedback` (Task 5).

- [ ] **Step 1: Update the test to expect an RPC call instead of a local insert**

Replace the full file content of `src/app/actions/feedback.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserMock, rpcMock, schemaMock, createServerClientMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    schemaMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  rpcMock.mockReset().mockResolvedValue({ data: { id: "fb1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitFeedbackAction", () => {
  it("calls the RPC with loopkit's kit slug, nps, and message", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 9, message: "Great!" });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_vendor_feedback", {
      p_kit_slug: "loopkit",
      p_nps: 9,
      p_message: "Great!",
    });
  });

  it("rejects an out-of-range nps before calling the RPC", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 11 });
    expect(result.success).toBe(false);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({ success: false, error: "Please sign in first" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({
      success: false,
      error: "Could not send feedback",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: FAIL — the action still calls `.from("feedback").insert(...)`, so
`schemaMock`/`rpcMock` are never invoked.

- [ ] **Step 3: Update the action**

Replace the full file content of `src/app/actions/feedback.ts`:

```ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { submitVendorFeedback } from "@/lib/merqo-vendor-feedback";
import type { ActionResult } from "@/lib/action-result";

const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/**
 * Submit vendor NPS feedback for loopkit into the shared cross-kit
 * merqo.vendor_feedback table via merqo.submit_vendor_feedback — the
 * SECURITY DEFINER function is the authorization boundary (it writes
 * auth.uid() as vendor_id itself, never a passed-in value).
 */
export async function submitFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitVendorFeedback(
      supabase,
      "loopkit",
      parsed.data.nps,
      parsed.data.message ?? null,
    );
  } catch (err) {
    console.error(
      "submitFeedbackAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: 4 tests, all PASS.

- [ ] **Step 5: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS. `src/components/feedback-form.dom.test.tsx` (the form UI
test) is unaffected — it mocks `submitFeedbackAction` at the module
boundary, not its internals.

- [ ] **Step 6: Commit, push, open PR, merge**

```bash
git add src/app/actions/feedback.ts src/app/actions/feedback.test.ts
git commit -m "feat: submit loopkit vendor feedback to the shared merqo table"
git push -u origin feat/cross-kit-vendor-feedback
gh pr create --title "feat: converge loopkit vendor feedback into merqo.vendor_feedback" --body "Backfills existing local feedback rows and swaps submitFeedbackAction to call merqo.submit_vendor_feedback. Requires merqo's 0011_vendor_feedback.sql to already be merged. See merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Task 7: stockkit backfill migration + RPC wrapper

**Files:**

- Create (stockkit repo): `supabase/migrations/0005_vendor_feedback_backfill.sql`
- Create (stockkit repo): `src/lib/merqo-vendor-feedback.ts`
- Modify (stockkit repo): `src/lib/README.md`

**Interfaces:**

- Consumes: `merqo.submit_vendor_feedback` (Task 1, must already be merged).
- Produces: `submitVendorFeedback<Db, SchemaName>(supabase, kitSlug, nps,
message)` — Task 8 calls this.

- [ ] **Step 1: Write the backfill migration**

```sql
-- One-time copy of existing local feedback rows into the shared
-- merqo.vendor_feedback table (merqo migration 0011). See
-- merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md
insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message, created_at)
select 'stockkit', vendor_id, nps, message, created_at
from stockkit.feedback f
where not exists (
  select 1 from merqo.vendor_feedback vf
  where vf.kit_slug = 'stockkit'
    and vf.vendor_id = f.vendor_id
    and vf.created_at = f.created_at
);
```

- [ ] **Step 2: Write the RPC wrapper**

stockkit's own source is single-quoted (see its existing
`src/app/actions/feedback.ts`) — match that style here, unlike loopkit/
paykit's double-quoted equivalent.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_vendor_feedback RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside stockkit's
 * own supabase gen types scope (schema: "stockkit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md.
 */
type MerqoVendorFeedbackSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_vendor_feedback: {
        Args: { p_kit_slug: string; p_nps: number; p_message: string | null };
        Returns: { id: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Callers pass in a client already scoped to their own (stockkit) Database
 * and schema name — same generic-over-caller's-client pattern as
 * merqo-vendor-profile.ts, for the same reason (a bare SupabaseClient
 * defaults its schema-name param to "public", which a real caller scoped
 * to "stockkit" doesn't structurally match).
 */
export async function submitVendorFeedback<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  kitSlug: string,
  nps: number,
  message: string | null,
): Promise<void> {
  const merqoClient =
    supabase as unknown as SupabaseClient<MerqoVendorFeedbackSchema>;
  const { error } = await merqoClient
    .schema("merqo")
    .rpc("submit_vendor_feedback", {
      p_kit_slug: kitSlug,
      p_nps: nps,
      p_message: message,
    });
  if (error) {
    throw new Error(`submit_vendor_feedback failed: ${error.message}`);
  }
}
```

- [ ] **Step 3: Update `src/lib/README.md`**

Replace the file's second sentence (currently ending "...`action-result.ts`
— `ActionResult<T>` server-action return type; `supabase/` — browser/server/
service clients.") to add the new file, keeping the rest of the paragraph
unchanged:

```markdown
Shared utilities and business logic. `schemas.ts` — Zod schemas for forms
and server actions; `types.ts` — hand-maintained DB types mirroring
`supabase/migrations/`; `stock.ts` — stock-status (ok/low/out)
classification; `action-result.ts` — `ActionResult<T>` server-action
return type; `merqo-vendor-feedback.ts` — `submitVendorFeedback`:
hand-written mirror of merqo's cross-schema `submit_vendor_feedback` RPC
contract, generic over the caller's own `Database`/schema; `supabase/` —
browser/server/service clients.
```

- [ ] **Step 4: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/cross-kit-vendor-feedback
git add supabase/migrations/0005_vendor_feedback_backfill.sql src/lib/merqo-vendor-feedback.ts src/lib/README.md
git commit -m "feat: add vendor_feedback backfill migration and RPC wrapper"
```

---

## Task 8: stockkit — swap `submitFeedbackAction` to the shared RPC

**Files:**

- Modify: `src/app/actions/feedback.ts`
- Create: `src/app/actions/feedback.test.ts` (stockkit has no existing test
  for this action — confirmed by search before writing this plan)

**Interfaces:**

- Consumes: `submitVendorFeedback` from `@/lib/merqo-vendor-feedback` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserMock, rpcMock, schemaMock, createServerClientMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    schemaMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  rpcMock.mockReset().mockResolvedValue({ data: { id: "fb1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitFeedbackAction", () => {
  it("calls the RPC with stockkit's kit slug, nps, and message", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 9, message: "Great!" });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_vendor_feedback", {
      p_kit_slug: "stockkit",
      p_nps: 9,
      p_message: "Great!",
    });
  });

  it("rejects an out-of-range nps before calling the RPC", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 11 });
    expect(result.success).toBe(false);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({ success: false, error: "Please sign in first" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({
      success: false,
      error: "Could not send feedback",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: FAIL — the action still calls `.from('feedback').insert(...)`.

- [ ] **Step 3: Update the action**

Replace the full file content of `src/app/actions/feedback.ts`:

```ts
"use server";
import type { ActionResult } from "@/lib/action-result";
import { feedbackSchema, type FeedbackInput } from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import { submitVendorFeedback } from "@/lib/merqo-vendor-feedback";

/**
 * Submit vendor NPS feedback for stockkit into the shared cross-kit
 * merqo.vendor_feedback table via merqo.submit_vendor_feedback — the
 * SECURITY DEFINER function is the authorization boundary (it writes
 * auth.uid() as vendor_id itself, never a passed-in value).
 */
export async function submitFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitVendorFeedback(
      supabase,
      "stockkit",
      parsed.data.nps,
      parsed.data.message ?? null,
    );
  } catch (err) {
    console.error(
      "submitFeedbackAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: 4 tests, all PASS.

- [ ] **Step 5: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS. `src/components/feedback-form.dom.test.tsx` is unaffected
(mocks the action at the module boundary).

- [ ] **Step 6: Commit, push, open PR, merge**

```bash
git add src/app/actions/feedback.ts src/app/actions/feedback.test.ts
git commit -m "feat: submit stockkit vendor feedback to the shared merqo table"
git push -u origin feat/cross-kit-vendor-feedback
gh pr create --title "feat: converge stockkit vendor feedback into merqo.vendor_feedback" --body "Backfills existing local feedback rows and swaps submitFeedbackAction to call merqo.submit_vendor_feedback. Requires merqo's 0011_vendor_feedback.sql to already be merged. See merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Task 9: paykit backfill migration + RPC wrapper

**Files:**

- Create (paykit repo): `supabase/migrations/0004_vendor_feedback_backfill.sql`
- Create (paykit repo): `src/lib/merqo-vendor-feedback.ts`

**Interfaces:**

- Consumes: `merqo.submit_vendor_feedback` (Task 1, must already be merged).
- Produces: `submitVendorFeedback<Db, SchemaName>(supabase, kitSlug, nps,
message)` — Task 10 calls this.

No README update in this task — paykit has no `src/lib/README.md` (confirmed
by search; only `src/app/actions/README.md` exists, updated in Task 10).

- [ ] **Step 1: Write the backfill migration**

```sql
-- One-time copy of existing local feedback rows into the shared
-- merqo.vendor_feedback table (merqo migration 0011). See
-- merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md
insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message, created_at)
select 'paykit', vendor_id, nps, message, created_at
from paykit.feedback f
where not exists (
  select 1 from merqo.vendor_feedback vf
  where vf.kit_slug = 'paykit'
    and vf.vendor_id = f.vendor_id
    and vf.created_at = f.created_at
);
```

- [ ] **Step 2: Write the RPC wrapper**

This mirrors paykit's own existing `src/lib/merqo-support.ts` almost
exactly — same generic pattern, one new concept.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_vendor_feedback RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside paykit's
 * own supabase gen types scope (schema: "paykit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md.
 */
type MerqoVendorFeedbackSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_vendor_feedback: {
        Args: { p_kit_slug: string; p_nps: number; p_message: string | null };
        Returns: { id: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Callers pass in a client already scoped to their own (paykit) Database
 * and schema name — same generic-over-caller's-client pattern as
 * merqo-vendor-profile.ts and merqo-support.ts, for the same reason (a bare
 * SupabaseClient defaults its schema-name param to "public", which a real
 * caller scoped to "paykit" doesn't structurally match).
 */
export async function submitVendorFeedback<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  kitSlug: string,
  nps: number,
  message: string | null,
): Promise<void> {
  const merqoClient =
    supabase as unknown as SupabaseClient<MerqoVendorFeedbackSchema>;
  const { error } = await merqoClient
    .schema("merqo")
    .rpc("submit_vendor_feedback", {
      p_kit_slug: kitSlug,
      p_nps: nps,
      p_message: message,
    });
  if (error) {
    throw new Error(`submit_vendor_feedback failed: ${error.message}`);
  }
}
```

- [ ] **Step 3: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/cross-kit-vendor-feedback
git add supabase/migrations/0004_vendor_feedback_backfill.sql src/lib/merqo-vendor-feedback.ts
git commit -m "feat: add vendor_feedback backfill migration and RPC wrapper"
```

---

## Task 10: paykit — swap `submitFeedbackAction` to the shared RPC

**Files:**

- Modify: `src/app/actions/feedback.ts`
- Create: `src/app/actions/feedback.test.ts` (paykit has no existing test for
  this action — confirmed by search; `support.test.ts` in the same folder is
  the template this follows)
- Modify: `src/app/actions/README.md`

**Interfaces:**

- Consumes: `submitVendorFeedback` from `@/lib/merqo-vendor-feedback` (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserMock, rpcMock, schemaMock, createServerClientMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    schemaMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  rpcMock.mockReset().mockResolvedValue({ data: { id: "fb1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitFeedbackAction", () => {
  it("calls the RPC with paykit's kit slug, nps, and message", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 9, message: "Great!" });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_vendor_feedback", {
      p_kit_slug: "paykit",
      p_nps: 9,
      p_message: "Great!",
    });
  });

  it("rejects an out-of-range nps before calling the RPC", async () => {
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 11 });
    expect(result.success).toBe(false);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({ success: false, error: "Please sign in first" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { submitFeedbackAction } = await import("./feedback");
    const result = await submitFeedbackAction({ nps: 5 });
    expect(result).toEqual({
      success: false,
      error: "Could not send feedback",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: FAIL — the action still calls `.from("feedback").insert(...)`.

- [ ] **Step 3: Update the action**

Replace the full file content of `src/app/actions/feedback.ts`:

```ts
"use server";
import { createServerClient } from "@/lib/supabase/server";
import { feedbackSchema, type FeedbackInput } from "@/lib/schemas";
import { submitVendorFeedback } from "@/lib/merqo-vendor-feedback";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submit vendor NPS feedback for paykit into the shared cross-kit
 * merqo.vendor_feedback table via merqo.submit_vendor_feedback — the
 * SECURITY DEFINER function is the authorization boundary (it writes
 * auth.uid() as vendor_id itself, never a passed-in value).
 */
export async function submitFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback",
    };
  }

  const supabase = await createServerClient();
  // Intentionally an inline check, not the shared `getVendorSession()`
  // guard (used by dashboard/profile & dashboard/transactions actions):
  // that helper redirects to /login on no-session, which is wrong here —
  // this action backs a Sheet-embedded widget, not a full page, so an
  // unauthenticated caller should get a toast-visible error instead of a
  // hard redirect out of whatever page the Sheet is open on.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitVendorFeedback(
      supabase,
      "paykit",
      parsed.data.nps,
      parsed.data.message ?? null,
    );
  } catch (err) {
    console.error(
      "submitFeedbackAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/feedback.test.ts`
Expected: 4 tests, all PASS.

- [ ] **Step 5: Update `src/app/actions/README.md`**

Replace the existing `feedback.ts` bullet (lines 14-19):

```markdown
- `feedback.ts` — `submitFeedbackAction(input: FeedbackInput)`: validates
  with `feedbackSchema`, calls `submitVendorFeedback`
  (`@/lib/merqo-vendor-feedback`) to file into the shared cross-kit
  `merqo.vendor_feedback` table via `merqo.submit_vendor_feedback`, using an
  inline `supabase.auth.getUser()` check (not `getVendorSession()` — that
  helper redirects to `/login` on no session, wrong for a Sheet-embedded
  widget, which should surface a toast error instead of yanking the vendor
  off whatever page the Sheet was open on).
```

Add a bullet for the new test file right after the (unchanged)
`feedback.ts` bullet, before the existing `support.ts` bullet:

```markdown
- `feedback.test.ts` — mocks `createServerClient`'s `auth.getUser`/
  `schema().rpc()` chain: the RPC is called with the parsed nps/message and
  paykit's fixed `p_kit_slug: "paykit"`, an out-of-range nps never reaches
  the RPC, an unauthenticated caller gets an error without a redirect, and
  an RPC failure surfaces a friendly message (never the raw error).
```

- [ ] **Step 6: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit, push, open PR, merge**

```bash
git add src/app/actions/feedback.ts src/app/actions/feedback.test.ts src/app/actions/README.md
git commit -m "feat: submit paykit vendor feedback to the shared merqo table"
git push -u origin feat/cross-kit-vendor-feedback
gh pr create --title "feat: converge paykit vendor feedback into merqo.vendor_feedback" --body "Backfills existing local feedback rows and swaps submitFeedbackAction to call merqo.submit_vendor_feedback. Requires merqo's 0011_vendor_feedback.sql to already be merged. See merqo/docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Self-Review

**1. Spec coverage:** every element of the design spec's "What changes" and
"Guiding decisions" sections maps to a task: the table/RPC (Task 1), the
admin display's per-kit breakdown (Tasks 3-4), and each of the three kits'
backfill + code swap (Tasks 5-6, 7-8, 9-10). The spec's stated exclusion
(qkit, dropping local tables) has no corresponding task, correctly.

**2. Placeholder scan:** no TBD/TODO; every step shows complete code, not a
description of code.

**3. Type consistency:** `submitVendorFeedback(supabase, kitSlug, nps,
message)` has the identical parameter order and types across Tasks 5, 7, and
9's wrapper files and Tasks 6, 8, and 10's call sites.
`groupVendorFeedbackByKit`/`VendorFeedbackRow` (Task 2) match their usage in
Task 4 exactly (property names `kit_slug`/`nps`/`message`/`created_at`/`id`).

**4. One correction made against the design spec during planning:** the
spec's Testing section proposed a `merqo-vendor-feedback.test.ts` per kit
"mirroring paykit's own `merqo-support.test.ts`" — that file does not exist
in the real repo (confirmed by search). The actual, shipped precedent tests
the _action_ that calls the wrapper (`support.test.ts`, mocking
`schema().rpc()`), not a separate wrapper-level test. Tasks 6, 8, and 10
follow the real precedent instead of the spec's incorrect assumption.
