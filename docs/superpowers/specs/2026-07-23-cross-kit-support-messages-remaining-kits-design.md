# Cross-Kit Support Messages — Remaining Kits (loopkit, stockkit, qkit) — Design

**Date:** 2026-07-23
**Status:** Approved (design); plan to follow.
**Scope:** loopkit, stockkit, qkit. Extends
`docs/superpowers/specs/2026-07-23-cross-kit-support-messages-design.md`
(paykit, already shipped) — that spec's own RPC
(`merqo.submit_support_message`) is kit-agnostic and already live; this spec
only wires up the three kits that haven't adopted it yet.

## Summary

Confirmed by search: **loopkit and stockkit have no "Get help" flow at all**
today — their account-menu "Get help" item is a bare `mailto:support@merqo.app`
link, no form, no table. **qkit has a full local system already**: its own
`qkit.support_messages` table (categories `pass`/`payment`/`pro`/`other`),
a vendor-facing form, and an admin page with a resolve action — the same
kind of "already built, needs a cutover" situation qkit's vendor-feedback
convergence (separate spec) is in, not the "purely additive" situation
loopkit/stockkit are in.

- **loopkit + stockkit**: purely additive. Port paykit's already-shipped
  pattern verbatim — a real `SupportForm` Sheet replaces the `mailto:` link,
  backed by `merqo.submit_support_message` from day one. No local table ever
  existed, so no backfill.
- **qkit**: a real cutover. Its vendor-facing submit path swaps from a local
  RLS-insert to the same shared RPC; its admin inbox (read + resolve) moves
  from its own local table to `merqo.support_messages`, following the same
  admin-data-convergence standard qkit's vendor-feedback spec already
  applies; existing local rows are backfilled once.

### Guiding decisions (locked during brainstorming)

- **No merqo-side schema changes at all.** `merqo.support_messages` and
  `merqo.submit_support_message` already exist, already accept an arbitrary
  `kit_slug` and free-text `category` (the original support-messages spec
  already relaxed `category` to shape-only specifically because "each kit
  now owns its own category vocabulary at the app layer"). All three kits
  in this spec ship independently, no merqo-repo dependency.
- **loopkit/stockkit categories reflect their own product surface**, not
  paykit's (`payment`/`account`/`billing`/`other`) or qkit's
  (`pass`/`payment`/`pro`/`other`) — each kit already independently chose
  its own category set (paykit vs. qkit already differ), so this isn't a
  new precedent:
  - **loopkit**: `program` (program/card setup, stamps, rewards),
    `customers` (customer records, phone lookup), `billing` (Pro plan),
    `other`.
  - **stockkit**: `products` (products & stock setup), `account`
    (account/sign-in), `other` — no `billing` category; stockkit has no
    Pro/vendor-tier concept at all (confirmed in its own
    `dashboard-nav.tsx` comment: "No Plan item — stockkit has no
    vendor-tier concept").
- **qkit's write path becomes an app-level wrapper, not DB-level
  composition** (unlike qkit's vendor-feedback convergence). qkit's
  existing support-message submission is a plain RLS insert
  (`supabase.from("support_messages").insert(...)`) — there's no existing
  SQL function to extend the way `qkit.submit_feedback` existed for
  feedback. The natural integration point is the same app-layer wrapper
  every other kit uses (`src/lib/merqo-support.ts`, generic over the
  caller's `Db`/`SchemaName`, mirroring `merqo-vendor-feedback.ts`'s own
  shape already shipped in qkit for the feedback side).
- **qkit's admin resolve action needs no new merqo RPC.** Reading
  `docs/business/2026-07-23-admin-data-convergence-standard.md`'s own §4:
  a kit's own admin action, already gated by that kit's app-level admin
  check, may read/write its own slice of a shared table through its own
  **service-role client** — the same trust boundary already sanctioned for
  admin _reads_ extends symmetrically to admin _writes_, since the
  service-role client bypasses RLS entirely regardless of which schema it
  targets, and is never reachable from anything but already-gated
  server-only code. qkit's existing `resolveSupportMessage` action already
  uses `createServiceClient()`; only its query target changes (`.schema("merqo")`
  instead of the client's default `qkit` schema), not its authorization
  model.
- **qkit's local `support_messages` table stays in place, stops receiving
  new rows.** Same cutover shape as its vendor-feedback convergence:
  historical rows backfilled once into `merqo.support_messages`, new
  submissions go straight to the shared table, the old table isn't dropped
  in this spec (a later, separate migration, once a deploy cycle confirms
  the cutover).

## What changes — loopkit repo

### `supabase/migrations/<next>_no_op.sql`

None — loopkit's own schema is untouched. All new state lives in `merqo`
(already there).

### `src/lib/merqo-support.ts` (new)

Mirrors paykit's own `src/lib/merqo-support.ts` exactly (same generic
`Db`/`SchemaName` RPC-wrapper shape every `merqo-*.ts` file in this codebase
already follows), with `p_kit_slug: "loopkit"` hardcoded.

### `src/lib/schemas.ts`

Add, alongside the existing `feedbackSchema`:

```ts
export const supportMessageSchema = z.object({
  category: z.enum(["program", "customers", "billing", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  program: "Program / cards",
  customers: "Customers",
  billing: "Pro plan",
  other: "Something else",
};
```

### `src/app/actions/support.ts` (new)

Mirrors paykit's `src/app/actions/support.ts` exactly: inline
`supabase.auth.getUser()` check (not the shared vendor-auth guard — same
reasoning `feedback.ts` already established, a Sheet-embedded widget
shouldn't hard-redirect an unauthenticated caller), calls
`submitSupportMessage` from the new wrapper, maps a thrown error to
`"Could not send your message"`.

### `src/components/support-form.tsx` (new)

Mirrors paykit's `SupportForm` exactly, against loopkit's own
`SUPPORT_CATEGORY_LABELS`.

### `src/app/dashboard/dashboard-nav.tsx`

Replace the `mailto:` `DropdownMenuItem` (lines 207-212) with a `helpOpen`
Sheet, identical in structure to the existing `feedbackOpen` Sheet already
in this file:

```tsx
const [helpOpen, setHelpOpen] = useState(false);
```

```tsx
<DropdownMenuItem className="cursor-pointer" onSelect={() => setHelpOpen(true)}>
  <LifeBuoy className="size-4" />
  Get help
</DropdownMenuItem>
```

```tsx
<Sheet open={helpOpen} onOpenChange={setHelpOpen}>
  <SheetContent side="right" className="w-full sm:max-w-md">
    <SheetHeader>
      <SheetTitle className="text-2xl">Get help</SheetTitle>
      <SheetDescription>
        Trouble with a program, a customer, or your Pro plan? Tell us and
        we&apos;ll sort it out.
      </SheetDescription>
    </SheetHeader>
    <div className="px-4 pb-6">
      <SupportForm />
    </div>
  </SheetContent>
</Sheet>
```

(placed as a sibling of the existing `feedbackOpen` Sheet, at the bottom of
the component, same as paykit's file structures both Sheets side by side.)

## What changes — stockkit repo (identical shape, its own category set)

### `src/lib/merqo-support.ts` (new)

Same wrapper, single-quoted per stockkit's own style, `p_kit_slug: 'stockkit'`.

### `src/lib/schemas.ts`

```ts
export const supportMessageSchema = z.object({
  category: z.enum(["products", "account", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  products: "Products & stock",
  account: "Account / sign-in",
  other: "Something else",
};
```

### `src/app/actions/support.ts` (new), `src/components/support-form.tsx` (new)

Same shape as loopkit's, single-quoted, against stockkit's own category set.

### `src/app/dashboard/dashboard-nav.tsx`

Same swap: replace the `mailto:` `DropdownMenuItem` (lines 109-114) with a
`helpOpen` Sheet, mirroring the existing `feedbackOpen` Sheet already in
this file.

## What changes — qkit repo

### `supabase/migrations/0072_support_messages_convergence.sql` (new)

Guarded backfill only — no function/table changes needed on qkit's side
(the write-path swap is app-level, not DB-level, per the guiding decision
above).

```sql
-- Converge qkit's existing local support_messages rows into the shared
-- merqo.support_messages table (merqo migration 0010). New submissions go
-- straight to merqo going forward (see src/app/actions/support.ts); this is
-- a one-time historical copy. See
-- docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'merqo' AND table_name = 'support_messages'
  ) THEN
    INSERT INTO merqo.support_messages (user_id, kit_slug, category, body, status, created_at)
    SELECT vendor_id, 'qkit', category, body, status, created_at
    FROM qkit.support_messages sm
    WHERE NOT EXISTS (
      SELECT 1 FROM merqo.support_messages msm
      WHERE msm.kit_slug = 'qkit'
        AND msm.user_id = sm.vendor_id
        AND msm.created_at = sm.created_at
    );
  END IF;
END $$;
```

### `src/lib/merqo-support.ts` (new)

Same generic wrapper shape as every other kit's, `p_kit_slug: "qkit"`.

### `src/app/actions/support.ts`

`submitSupportMessage` swaps its `.from("support_messages").insert(...)`
call for `submitSupportMessage(supabase, category, body)` from the new
wrapper — same Zod validation, same error-shape, same "Please sign in
first" gate unchanged.

### `src/app/admin/actions.ts`

`resolveSupportMessage` changes its query target from the client's default
`qkit` schema to `merqo`:

```ts
const merqoClient = supabase as unknown as SupabaseClient<Database>;
const { data: updated, error } = await merqoClient
  .schema("merqo")
  .from("support_messages")
  .update({ status: "resolved" })
  .eq("id", parsed.data.id)
  .select("user_id")
  .maybeSingle();
```

(column is `user_id` on `merqo.support_messages`, not `vendor_id` — the
subsequent `recordAudit(supabase, { target_id: updated.user_id, ... })` call
updates its field access accordingly; `supabase` here is already the
service-role client `createServiceClient()` returns, unchanged.)

### `src/app/admin/page.tsx`

The open-messages query changes from local `qkit.support_messages` to
`merqo.support_messages` filtered to this kit:

```tsx
const merqoClient = supabase as unknown as SupabaseClient<Database>;
const { data: supportRows } = await merqoClient
  .schema("merqo")
  .from("support_messages")
  .select("id, user_id, category, body, created_at")
  .eq("kit_slug", "qkit")
  .eq("status", "open")
  .order("created_at", { ascending: true });
```

Rendering is otherwise unchanged — `category` is already free text (no
label lookup to update), and the row shape (`id`/vendor-identifying
column/`category`/`body`/`created_at`) is the same shape the page already
expects, just sourced from `user_id` instead of `vendor_id`.

## Error handling

- loopkit/stockkit: identical to paykit's already-shipped behavior — a
  thrown RPC error surfaces as `"Could not send your message"`, never the
  raw error; invalid category/empty body is rejected client-side by Zod
  before any network call.
- qkit's submit path: same mapping, now going through the RPC's own
  `auth.uid() is null` guard instead of a local RLS policy — behaviorally
  equivalent (both reject an unauthenticated caller), just enforced one
  layer over.
- qkit's resolve path: `updated` being `null` (row not found, or already
  resolved by a race) still surfaces `"Could not resolve"` exactly as
  today — the query shape changed, the failure-handling didn't.

## Testing

- **loopkit/stockkit**: `merqo-support.test.ts`-equivalent coverage isn't
  needed as a standalone file (matches the established precedent — no kit
  in this codebase has ever added one); `support.test.ts` (mocking
  `createServerClient`'s `auth.getUser`/`schema().rpc()` chain, mirroring
  paykit's own `support.test.ts` exactly) is the real test surface, plus a
  `support-form.dom.test.tsx` for the Sheet/category UI, plus
  `dashboard-nav.dom.test.tsx` updated to assert Get-help opens the Sheet
  instead of matching a `mailto:` href.
- **qkit**: `support.test.ts` updated to assert the RPC call shape instead
  of the local `.insert()` call (mirrors every other kit's own
  feedback/support action-test update this session); `admin/actions.test.ts`
  updated for `resolveSupportMessage`'s new query target and `user_id`
  field name; a pgTAP or vitest-mocked-SQL-text test for the backfill
  migration, mirroring the other kits' backfill tests' `NOT EXISTS`-guard
  assertions.

## Sequencing

No cross-repo ordering dependency — `merqo.submit_support_message` is
already live. loopkit, stockkit, and qkit each ship independently, in any
order, whenever convenient.

## Self-review

- No placeholders/TBDs.
- Internally consistent: every `merqo-support.ts` wrapper across the three
  kits calls the same real, already-shipped RPC signature
  (`p_kit_slug text, p_category text, p_body text`); loopkit/stockkit's
  own category sets are each kit's own choice, explicitly not required to
  match paykit's or qkit's (already an established precedent, not a new
  inconsistency).
- Scope: support/get-help convergence only — explicitly excludes qkit's
  customer-facing feedback (different spec) and does not touch paykit
  (already shipped, out of scope here).
- Ambiguity check: qkit's `merqo.support_messages.user_id` vs. its own
  local `vendor_id` column-name difference is called out explicitly in
  both the resolve-action and admin-page sections, so a future
  implementer doesn't silently reference a column that doesn't exist on
  the shared table.
