# Cross-Kit Vendor Feedback / NPS — Design

**Date:** 2026-07-23
**Status:** Approved (design); plan to follow.
**Scope:** merqo (owns the new schema + RPC + admin display) plus loopkit,
stockkit, and paykit (code swap + backfill each).

## Summary

Each kit — loopkit, stockkit, and paykit — has its own local `feedback`
table (`vendor_id`, `nps` 0-10, `message`, `created_at`; byte-identical
schema across all three). None of the three currently show this data in
any admin UI — it's write-only today, invisible to the Merqo team unless
someone queries the raw table by hand. Meanwhile qkit's own `feedback`
table has a materially different shape (customer _and_ vendor sourced,
1-5 star `rating`, `booth_id`/`order_number`) and is explicitly out of
scope for this spec — this is about converging the three simple-NPS kits,
not qkit.

This spec adds `merqo.vendor_feedback`, a new shared table, and has
loopkit/stockkit/paykit write into it instead of their own local table.
Merqo's existing `/admin/feedback` page (today showing only Merqo hub's
own NPS, from the pre-existing `merqo.feedback` table — a different,
unrelated table, kept as-is) gains a new section breaking the shared data
down per kit. Each kit's own dashboard keeps whatever "leave feedback"
entry point it already has (a `Sheet`/form triggered from account menus,
per kit) — only where the submission goes changes, not the vendor-facing
UI. Since none of the three kits show feedback in their own admin pages
today, this is purely additive on the admin side — no existing per-kit
admin screen is being migrated or removed.

### Guiding decisions (locked during brainstorming)

- **Shared schema, not an HTTP pull.** Matches `merqo.vendor_profile`
  (`docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md`) —
  all kits already share one physical Postgres instance.
- **New table, not reusing `merqo.feedback`.** `merqo.feedback` already
  exists (migration `0007_feedback_and_support.sql`) and is a _different_
  concept: Merqo hub's own NPS from signed-in users about Merqo itself, no
  `kit_slug`/vendor-of-a-kit concept. Overloading it would conflate "how do
  you rate Merqo" with "how do you rate loopkit" under one undifferentiated
  bucket. `merqo.vendor_feedback` is a sibling table, named after
  `vendor_profile`'s own convention.
- **RPC-only write path, matching today's newest precedent
  (`2026-07-23-cross-kit-support-messages-design.md`'s
  `submit_support_message`) rather than `merqo.feedback`'s own older
  plain-RLS-insert pattern.** Both precedents exist in this codebase;
  the support-messages one is the more recent and the better fit here —
  it reads `auth.uid()` directly inside the `SECURITY DEFINER` function
  body instead of trusting a passed-in id, which is strictly safer than
  `vendor_profile`'s "trust the caller's `p_vendor_id` argument" precedent
  and needs no extra ownership-check parameter. A single
  `merqo.submit_vendor_feedback(p_kit_slug, p_nps, p_message)` function is
  kit-agnostic — any future kit adopts it with no new schema.
- **Reads split by audience, not both RPC.** The only reader is each
  kit's own vendor-facing "read back your own feedback" (not needed — no
  kit shows this today, YAGNI) and Merqo's own admin page. Merqo's admin
  page already runs as a signed-in Merqo-team member against its own
  schema — no RPC indirection needed there, same as `support_messages`'s
  own admin read today (a plain `.from("support_messages").select(...)`
  gated by the `_select` RLS policy, not a function call). So:
  `merqo.vendor_feedback` gets one RLS `SELECT` policy
  (`is_merqo_team`), no RLS `INSERT` policy (write is RPC-only, and
  `SECURITY DEFINER` bypasses RLS entirely for that path).
- **No change needed to any kit's own admin page.** Confirmed by search:
  none of loopkit/stockkit/paykit have an admin/feedback page today. Per
  the user's ask ("the admin page per product still remain"), if a kit
  _did_ have one, the standing rule (written into the new
  `docs/business` standard, see below) is that kit reads its own local
  slice via its own service-role client gated by its own existing
  app-level admin check — never by teaching `merqo.vendor_feedback`'s RLS
  about each kit's differing admin concept (loopkit has
  `loopkit.is_admin`; stockkit and paykit have no admin concept in their
  DB at all).
- **`kit_slug` is `NOT NULL`.** Unlike `support_messages.kit_slug`
  (nullable, `null` = "about Merqo hub itself"), every row in
  `vendor_feedback` is inherently about some kit — Merqo hub's own NPS
  already has its own table (`merqo.feedback`) and isn't part of this one.
  No null-meaning ambiguity to document.
- **`nps` keeps its DB-level `CHECK (0 AND 10)`.** Unlike
  `support_messages.category` (which varies per kit and had its CHECK
  relaxed to shape-only), all three source kits already use the identical
  0-10 NPS scale — a real, shared constraint, not an artificial one to
  relax.

## What changes — merqo repo

### `supabase/migrations/0011_vendor_feedback.sql` (new)

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

### `src/app/admin/feedback/page.tsx`

Add a second section, "Vendor feedback by kit," below the existing Merqo-hub
NPS section (untouched). Query `merqo.vendor_feedback` (id, kit_slug, nps,
message, created_at; limit 500; order by created_at desc), group rows by
`kit_slug`, and render one `npsBreakdown()` card per kit (same score/bar/
detractor-passive-promoter layout the hub section already uses, reused as-is
— no new component, just called once per kit group instead of once total).
Comments render in one combined list below, each tagged with a small
`kit_slug` badge, newest first — mirrors the kit-slug-badge treatment
`admin/page.tsx` already added for support messages
(`2026-07-23-cross-kit-support-messages-design.md`), for visual consistency
between the two admin surfaces.

```tsx
const { data: vendorRows, error: vendorError } = await supabase
  .from("vendor_feedback")
  .select("id, kit_slug, nps, message, created_at")
  .order("created_at", { ascending: false })
  .limit(500);
if (vendorError)
  throw new Error(`vendor_feedback read failed: ${vendorError.message}`);
const byKit = Map.groupBy(vendorRows ?? [], (r) => r.kit_slug as string);
```

Each group's card reuses the same `npsBreakdown(rows.map(r => r.nps))` call
and bar/legend JSX already in the file, extracted into a small local
`NpsCard` helper so it isn't duplicated four times (once for the hub's own
section, three-plus for each kit group) — this is the one factoring change
this task makes to the existing file, since the file would otherwise
literally repeat the same ~30-line block per kit.

## What changes — loopkit / stockkit / paykit repos (identical shape each)

### `supabase/migrations/<next>_vendor_feedback_backfill.sql` (new, per kit)

One-time copy of existing local rows into the shared table, idempotent via
an explicit `NOT EXISTS` guard (no natural unique key survives the copy, so
this can't use `ON CONFLICT`):

```sql
insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message, created_at)
select '<kit_slug>', vendor_id, nps, message, created_at
from public.feedback f
where not exists (
  select 1 from merqo.vendor_feedback vf
  where vf.kit_slug = '<kit_slug>'
    and vf.vendor_id = f.vendor_id
    and vf.created_at = f.created_at
);
```

(`<kit_slug>` is literally `'loopkit'`, `'stockkit'`, or `'paykit'` — each
kit's own migration hardcodes its own slug, same as paykit's
`submit_support_message` call already hardcodes `p_kit_slug: "paykit"`.)

> **Post-review update:** the shipped migrations wrap this `insert` in a
> `do $$ begin if exists (select 1 from information_schema.tables where
> table_schema = 'merqo' and table_name = 'vendor_feedback') then ... end
> if; end $$;` guard — the snippet above, run unguarded, hard-failed each
> kit's own CI (`supabase start` builds a fresh Postgres from only that
> kit's migrations, with no `merqo` schema at all). Same guard pattern
> `qkit/supabase/migrations/0054_vendor_profile_backfill.sql` already
> established for the identical failure class. Treat each kit's actual
> shipped migration file as source of truth over this snippet.

### `src/lib/merqo-vendor-feedback.ts` (new, per kit)

Mirrors paykit's own `src/lib/merqo-support.ts` (added in the support-
messages spec) — same generic-over-`Db`/`SchemaName` RPC-call shape:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

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

### `src/app/actions/feedback.ts` (modified, per kit)

`submitFeedbackAction` swaps its `.from("feedback").insert(...)` call for
`submitVendorFeedback(supabase, "<kit_slug>", parsed.data.nps, parsed.data.message ?? null)`,
keeping the same Zod parse, same "Please sign in first"/"Could not send
feedback" error shape. loopkit's current version (shown below) is the
template every kit follows, adjusted only for its own kit slug:

```ts
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
  } catch (error) {
    console.error(
      "submitFeedbackAction failed",
      error instanceof Error ? error.message : error,
    );
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
```

### Local `feedback` table

Left in place for now (both the table and its RLS policies) — dropped in a
separate, later migration per kit once one full deploy cycle confirms the
cutover worked, same convention `vendor_profile`'s own cutover already
established. Not part of this spec's task list.

## Error handling

- `submit_vendor_feedback` raises if called unauthenticated (`auth.uid() is
null`) — the same guard `submit_support_message` already uses; no kit can
  reach this path without a signed-in vendor session in the first place, so
  this is a defense-in-depth check, not an expected runtime path.
- A malformed `p_message` (empty string) is normalized to `NULL` via
  `nullif`, matching `submit_support_message`'s own empty-string handling
  and `merqo.feedback`'s existing `message` column convention.
- `p_nps` outside 0-10 fails the table's `CHECK` constraint and the RPC call
  returns a Postgres error — each kit's own Zod `feedbackSchema` (already
  `z.number().int().min(0).max(10)`) rejects this before the RPC is ever
  called, so this is a second, redundant backstop, not the primary
  validation layer.

## Testing

- **merqo**: pgTAP or vitest-mocked test confirming `vendor_feedback`'s RLS
  is insert-deny/team-select-only, and that `submit_vendor_feedback` is
  `SECURITY DEFINER`, granted to `authenticated`, and rejects a null
  `auth.uid()`. `admin/feedback/page.tsx` gets a rendering test for the new
  per-kit section (grouping, the extracted `NpsCard` helper rendering
  correctly for zero/one/many kits).
- **loopkit / stockkit / paykit** (each): `merqo-vendor-feedback.test.ts`
  (mocked RPC call, mirrors paykit's own `merqo-support.test.ts` pattern),
  `actions/feedback.test.ts` updated to assert the RPC call shape (kit slug,
  nps, message) instead of the raw local `.insert()` call — existing
  "Please sign in first" / Zod-rejection tests are unchanged since the
  validation layer in front of the call doesn't move.

## Sequencing

merqo's migration (`0011`) must be live on the shared Postgres instance
before any kit's backfill migration or code swap runs — same cross-repo
ordering rule already established in
`2026-07-16-shared-vendor-profile-design.md` and re-confirmed in
`2026-07-23-cross-kit-support-messages-design.md`. Order within this spec:
merqo migration + admin page first, then loopkit, stockkit, and paykit each
independently (backfill migration, then code swap) — the three kits don't
depend on each other, only on merqo's `0011` being live first.

## Self-review

- No placeholders/TBDs.
- Internally consistent: `merqo-vendor-feedback.ts`'s RPC args match
  `submit_vendor_feedback`'s SQL signature exactly across all three kits;
  the backfill migration's `NOT EXISTS` guard matches the table's actual
  (lack of) unique constraints, so it doesn't assume an `ON CONFLICT` target
  that doesn't exist.
- Scope: three kits' write-path convergence + merqo's admin display only —
  explicitly excludes qkit (different data shape, flagged as out of scope
  in the Summary) and excludes dropping any kit's local table (deferred,
  separate future migration per the standing convention).
- Ambiguity check: `kit_slug` is `NOT NULL` with no hub-row case, stated
  explicitly as the point of difference from `support_messages`'s nullable
  column, so a future reader doesn't have to infer why the two sibling
  tables differ there.
