# Cross-Kit Support Messages — Design

**Date:** 2026-07-23
**Status:** Approved (design); plan to follow.

## Summary

`merqo.support_messages` (migration `0009_feedback_and_support.sql` —
correction, `0007_feedback_and_support.sql`) exists today, but is scoped
to hub-only concerns: its `category` CHECK constrains to `vendor_access`/
`billing`/`team`/`other`, and nothing records _which kit_ a message is
about. Every kit that wants a real "Get help" flow (not qkit's own local
`support_messages` table, not a `mailto:` link) has been re-solving this
per kit — paykit's own account menu currently opens a `mailto:` link,
explicitly flagged as a sanctioned-but-temporary interim per
`Merqo Business/docs/business/2026-07-21-dashboard-nav-standard.md`.

This spec extends `merqo.support_messages` into a real cross-kit inbox:
one table, one admin surface (`/admin`, already built), reachable by any
kit via a new `SECURITY DEFINER` RPC — the same "shared table, RPC-only
access" pattern `merqo.vendor_profile` already established
(`docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md`).
paykit is the first kit wired up as a consumer; the RPC itself is
kit-agnostic, so qkit or loopkit can adopt it later without further
schema changes.

**Deliberately out of scope:** migrating qkit's own existing local
`support_messages` table to this shared one. That's real, separate,
qkit-repo work — same boundary drawn around paykit's T1 (not touching
qkit) earlier. This spec only adds the shared capability and wires up
paykit, the kit that has nothing today.

### Guiding decisions (locked during brainstorming)

- **RPC-only cross-schema access, matching `vendor_profile` exactly.**
  paykit's own Supabase client is scoped to schema `"paykit"` — it cannot
  and must not query `merqo.support_messages` directly. A new
  `merqo.submit_support_message(p_kit_slug, p_category, p_body)`
  `SECURITY DEFINER` function is the only way a kit writes into this
  table, mirroring `get_or_create_vendor_profile`/`upsert_vendor_profile`'s
  own precedent down to the `auth.uid()`-as-`user_id` ownership rule (a
  caller can only ever file a message as themselves — the function reads
  `auth.uid()`, never trusts a passed-in user id).
- **`kit_slug` is nullable, additive.** `null` means "about Merqo hub
  itself" — the existing, unchanged meaning of every row today. A kit
  passing its own slug (`"paykit"`, `"qkit"`, ...) is new. No backfill
  needed; every existing row's `kit_slug` stays `null`, correctly.
- **`category` stops being a fixed enum.** The current CHECK
  (`vendor_access`/`billing`/`team`/`other`) only makes sense for the
  hub's own categories — paykit's issues aren't "billing" or "team."
  Drop the DB-level CHECK; each kit's own Zod schema (client-side and
  RPC-adjacent) constrains its own category set to a short, kit-specific
  list. The DB only enforces shape (non-empty, capped length), same as
  `body` already is. Merqo hub's own existing local support form
  (`src/app/actions/support.ts`, a same-schema RLS-insert, unrelated to
  the new RPC) is untouched — it keeps writing its own 4 hub categories
  as free text now instead of a CHECK-validated enum, with identical
  real-world behavior since its own Zod schema already constrains input
  before it ever reaches the DB.
- **Admin page displays `category` as raw text plus the kit it's from.**
  `SUPPORT_CATEGORY_LABELS` (a hub-categories-only lookup table) can't
  label a kit-specific category it's never heard of. Replace the lookup
  with the category string itself (already human-readable — "payment",
  "checkout", "billing") and add a small kit-slug badge/prefix so an
  admin triaging a mixed inbox immediately knows which product a message
  concerns. A `null` `kit_slug` renders as "Merqo" (today's implicit
  scope, now explicit).
- **paykit's `SupportForm`/category set ports qkit's UI pattern, not its
  categories.** qkit's own local form uses `pass`/`payment`/`pro`/`other`
  — paykit categories should reflect paykit's own product surface
  instead: `payment` (checkout/QR/payment-link issues), `account`
  (profile, sign-in), `billing` (Pro plan), `other`.

## What changes — merqo repo

### `supabase/migrations/0010_cross_kit_support_messages.sql` (new)

```sql
-- Extends merqo.support_messages (0007) into a cross-kit inbox: a
-- nullable kit_slug (null = about Merqo hub itself, unchanged meaning of
-- every existing row) and a category CHECK relaxed to shape-only, since
-- each kit now owns its own category vocabulary at the app layer. See
-- docs/superpowers/specs/2026-07-23-cross-kit-support-messages-design.md

alter table merqo.support_messages
  add column kit_slug text;

alter table merqo.support_messages
  drop constraint support_messages_category_check;

alter table merqo.support_messages
  add constraint support_messages_category_shape
    check (char_length(category) between 1 and 40);

create or replace function merqo.submit_support_message(
  p_kit_slug text,
  p_category text,
  p_body text
) returns merqo.support_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.support_messages;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into merqo.support_messages (user_id, kit_slug, category, body)
  values (auth.uid(), nullif(p_kit_slug, ''), p_category, p_body)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.submit_support_message(text, text, text)
  to authenticated;
```

(No new INSERT policy needed — `SECURITY DEFINER` bypasses RLS the same
way `upsert_vendor_profile` does; the existing
`support_messages_self_insert`/`_select`/`_team_update` policies are
untouched and keep governing the hub's own direct-insert path.)

### `src/lib/feedback-support-schemas.ts`

`supportMessageSchema`'s `category` enum stops being the single source of
truth for every caller — it's Merqo-hub-specific and stays that way
(the hub's own form still uses it unchanged). No change to this file;
paykit gets its own schema in its own repo (see below), same as qkit's
own local `supportMessageSchema` is qkit-local today.

### `src/lib/support.ts`

`OpenSupportMessage` gains `kit_slug: string | null`; `listOpenSupportMessages`
selects it:

```ts
export type OpenSupportMessage = {
  id: string;
  email: string | null;
  kit_slug: string | null;
  category: string;
  body: string;
  created_at: string;
};
```

(`category` becomes a plain `string` — no longer typed against the
hub-only enum, since a row can now hold any kit's category string.)

### `src/app/admin/page.tsx`

Replace `SUPPORT_CATEGORY_LABELS[m.category]` with `m.category` directly,
prefixed by the kit it's from:

```tsx
<p className="truncate text-xs text-muted-foreground">
  <span className="font-mono uppercase text-[10px] tracking-wide">
    {m.kit_slug ?? "merqo"}
  </span>{" "}
  · {m.category} — {m.body}
</p>
```

## What changes — paykit repo

### `supabase/migrations/0004_paykit_no_op.sql`

None — paykit's own schema is untouched. All new state lives in `merqo`.

### `src/lib/schemas.ts`

```ts
export const supportMessageSchema = z.object({
  category: z.enum(["payment", "account", "billing", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  payment: "Payment / checkout",
  account: "Account / sign-in",
  billing: "Pro plan",
  other: "Something else",
};
```

### `src/lib/merqo-support.ts` (new)

Mirrors `merqo-vendor-profile.ts`'s generic-over-`Db`/`SchemaName`
pattern:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

type MerqoSupportSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_support_message: {
        Args: { p_kit_slug: string; p_category: string; p_body: string };
        Returns: { id: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export async function submitSupportMessage<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  category: string,
  body: string,
): Promise<void> {
  const merqoClient = supabase as unknown as SupabaseClient<MerqoSupportSchema>;
  const { error } = await merqoClient
    .schema("merqo")
    .rpc("submit_support_message", {
      p_kit_slug: "paykit",
      p_category: category,
      p_body: body,
    });
  if (error) {
    throw new Error(`submit_support_message failed: ${error.message}`);
  }
}
```

### `src/app/actions/support.ts` (new)

```ts
"use server";

import { getVendorSession } from "@/lib/vendor-session";
import { supportMessageSchema } from "@/lib/schemas";
import { submitSupportMessage } from "@/lib/merqo-support";
import type { ActionResult } from "@/lib/action-result";

export async function submitSupportMessageAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }
  const { supabase } = await getVendorSession();
  try {
    await submitSupportMessage(
      supabase,
      parsed.data.category,
      parsed.data.body,
    );
  } catch {
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}
```

### `src/components/support-form.tsx` (new)

Ports qkit's `SupportForm` shape (category `ToggleGroup` + `Textarea` +
submit button, a "sent" confirmation state) against paykit's own
`SUPPORT_CATEGORY_LABELS`/`submitSupportMessageAction`.

### `src/app/dashboard/dashboard-nav.tsx`

Replace the `mailto:` `DropdownMenuItem` with one opening a new `helpOpen`
`Sheet` (identical structure to the existing `feedbackOpen` Sheet),
rendering `SupportForm`. Drop the file-header comment's "Get-help is a
mailto link" note — no longer true.

## Testing

- merqo: a pgTAP or vitest-mocked test that `submit_support_message`
  writes `kit_slug`/`category`/`body` correctly and rejects an
  unauthenticated caller; `admin/page.tsx`'s rendering doesn't need new
  tests beyond existing coverage (a display-string swap).
- paykit: `merqo-support.test.ts` (mocked RPC call, mirrors
  `merqo-vendor-profile.ts`'s own test pattern if one exists, otherwise a
  fresh one), `actions/support.test.ts` (parses input, calls through,
  surfaces a friendly error on RPC failure), `support-form.dom.test.tsx`
  (category selection, submit, sent-confirmation state),
  `dashboard-nav.dom.test.tsx` updated: Get-help is no longer a `mailto:`
  link — it opens the Sheet (same assertion shape as the existing
  Feedback-Sheet test).

## Sequencing

merqo's migration + RPC must be live before paykit's code has anything to
call — same cross-repo migration-ordering rule
`2026-07-21-profile-settings-page-standard.md` already established
("merqo's migration must be live on the shared Postgres instance before
any dependent kit migration runs"). Since this environment can't apply
migrations to the live shared Supabase project (no `.env.local`
credentials in this sandbox, same gap flagged all session), both halves
are written and tested (mocked) here, but the merqo migration is what
actually has to deploy first in the real environment.

## Self-review

- No placeholders/TBDs.
- Internally consistent: `merqo-support.ts`'s RPC args match
  `submit_support_message`'s SQL signature exactly; paykit's category
  enum is paykit's own, not accidentally reusing the hub's.
- Scope: cross-kit capability + paykit wiring only — explicitly excludes
  migrating qkit's existing local table (separate, later, qkit-repo work).
- Ambiguity check: `kit_slug` nullability and its exact meaning (`null` =
  hub) is stated explicitly, not left implicit; the admin display's
  kit-slug badge behavior for `null` is spelled out ("merqo").
