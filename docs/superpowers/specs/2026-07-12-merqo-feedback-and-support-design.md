# In-App Feedback & Support (qkit-mirrored) — Design

**Date:** 2026-07-12
**Status:** Approved (brainstorm)
**Scope:** Replace `AccountMenu`'s mailto-based "Contact Merqo" with two
in-app, qkit-mirrored mechanisms — a Feedback form (NPS) and a Support form
(categorized help request) — each opened as a Sheet drawer, writing to new
Merqo tables, surfaced to the team on `/admin`. Merqo repo only.

## Context

The just-shipped navbar-account-parity feature gave `AccountMenu` a "Get
Help" submenu that routes to each active kit's own support surface, plus a
"Contact Merqo" `mailto:` link for hub-level issues. That mailto was a
deliberate placeholder — the brainstorm at the time offered a heavier
"Merqo-native inbox" option and a lighter "route + mailto" option; the
lighter option was chosen specifically to avoid the schema/build cost of the
heavier one.

The user has since asked for the heavier option after all, explicitly
modeled on qkit's real implementation: qkit has a `FeedbackForm` (rating/NPS

- message → `feedback` table) and a `SupportForm` (category + free text →
  `support_messages` table), both opened as `Sheet` drawers from
  `DashboardNav`'s account menu (two flat sibling items, "Get help" and
  "Feedback" — not nested). qkit's admin reads open support messages inline on
  its main `/admin` page and gives `feedback` its own `/admin/feedback` page
  (NPS score, detractor/passive/promoter breakdown, comments).

qkit's `feedback` table also carries customer order ratings (`rating`,
`booth_id`, `order_number`) and a rate-limited, `SECURITY DEFINER`-RPC
insert path for anonymous customer submissions — none of that applies to
Merqo, which has no customers, no orders, no booths, and no unauthenticated
submitters (every `AccountMenu` user is signed in). Only the vendor-facing
NPS slice of qkit's feedback system — "how likely are you to recommend
[product] to another business" + optional comment — has a Merqo equivalent.

Merqo already has an established Sheet-free UI kit; `sheet.tsx` does not
exist yet, but `radix-ui` (which qkit's `Sheet` wraps) is already a
dependency, so adding it is a new file with no new package.

Naming: qkit's flat "Get help" item name is unavailable in Merqo (already
means the per-kit routing submenu, out of scope here). The new Support-Sheet
trigger is named **"Report a problem"** instead, sitting as a sibling to the
existing "Get Help" submenu; **"Feedback"** is a second new sibling item.

## Goal

A signed-in Merqo user (vendor or team member) can send hub-level feedback
or report a hub-level problem without leaving the app, and the Merqo team
can see and act on both from `/admin`.

## Non-goals

- **No changes to the existing "Get Help" submenu's per-kit routing** —
  that stays exactly as shipped; only the "Contact Merqo" mailto item is
  removed and replaced by the two new sibling items.
- **No qkit-style CSAT/star-rating/booth/customer machinery.** Merqo's
  `feedback` table is NPS + message only — no `rating`, no `booth_id`, no
  `order_number`, no `source` discriminator (every submitter is a signed-in
  Merqo user, full stop).
- **No rate limiting or `SECURITY DEFINER` RPC on the insert path.** qkit
  needs those because its feedback insert is public/anonymous; Merqo's
  submitters are always authenticated, so a plain RLS-scoped `insert` is
  sufficient (mirrors `support_messages`' own insert path in qkit, which
  also skips the RPC for the same reason — only qkit's customer-facing
  `feedback` needs it).
- **No audit-log entry on resolving a support message.** qkit's
  `resolveSupportMessage` calls `recordAudit`; Merqo has no audit-log
  infrastructure today, and adding one is out of scope for this feature.
- **No admin-side deletion or reopening of a resolved message.** Mirrors
  qkit — open → resolved is one-way.

## Changes

### `supabase/migrations/0007_feedback_and_support.sql` (new)

```sql
CREATE TABLE merqo.support_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL CHECK (category IN ('vendor_access', 'billing', 'team', 'other')),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_messages_open_idx
  ON merqo.support_messages (status, created_at DESC);

ALTER TABLE merqo.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_self_insert" ON merqo.support_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "support_messages_select" ON merqo.support_messages
  FOR SELECT USING (user_id = auth.uid() OR merqo.is_merqo_team(auth.uid()));

CREATE POLICY "support_messages_team_update" ON merqo.support_messages
  FOR UPDATE USING (merqo.is_merqo_team(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON merqo.support_messages TO authenticated;

CREATE TABLE merqo.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nps         INT         NOT NULL CHECK (nps BETWEEN 0 AND 10),
  message     TEXT        CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feedback_created_idx ON merqo.feedback (created_at DESC);

ALTER TABLE merqo.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_self_insert" ON merqo.feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_team_select" ON merqo.feedback
  FOR SELECT USING (merqo.is_merqo_team(auth.uid()));

GRANT SELECT, INSERT ON merqo.feedback TO authenticated;
```

Mirrors qkit's `support_messages`/`feedback` RLS shape exactly (self-insert,
self-or-team read, team-only resolve), scoped down to Merqo's actual fields.

### `src/components/ui/sheet.tsx` (new)

Ported verbatim from qkit's `src/components/ui/sheet.tsx` (a thin
shadcn/Radix `Dialog`-based wrapper — `Sheet`, `SheetTrigger`,
`SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`,
`SheetDescription`). No Merqo-specific changes; this is boilerplate
infrastructure, not product logic.

### `src/lib/feedback-support-schemas.ts` (new)

```typescript
export const supportMessageSchema = z.object({
  category: z.enum(["vendor_access", "billing", "team", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
```

### `src/components/support-form.tsx` and `src/components/feedback-form.tsx` (new)

Ported from qkit's `src/components/support-form.tsx` /
`src/components/feedback-form.tsx`, restyled to Merqo's existing card/button
language (not qkit's), with the qkit-specific pieces dropped:
`SupportForm`'s category list becomes `vendor_access`/`billing`/`team`/
`other` (labels: "Vendor access", "Billing", "Team", "Something else").
`FeedbackForm` keeps only the NPS 0–10 grid + optional message — no `source`
prop, no star-rating branch, no `boothId`/`orderNumber`/`token` props (none
of that exists in Merqo).

### `src/app/actions/support.ts` and `src/app/actions/feedback.ts` (new)

Two new signed-in-only Server Actions, `submitSupportMessageAction` and
`submitFeedbackAction`, each: `safeParse()` the input, read the signed-in
user via `createServerClient().auth.getUser()` (reject with a friendly error
if absent), insert via the **session client** (not service-role — RLS's
`self_insert` policy is the authorization boundary here, matching qkit's
own choice not to use the service role for these inserts either), return
`ActionResult`.

### `src/components/account-menu.tsx` (modify)

Add two `useState<boolean>` Sheet-open flags. Replace the "Contact Merqo"
`DropdownMenuItem` (currently nested inside the "Get Help" `DropdownMenuSub`)
with its removal, and add two new top-level `DropdownMenuItem`s —
"Feedback" and "Report a problem" — each with an `onSelect` that opens its
Sheet, siblings to the existing "Get Help" submenu and "Profile" link. Two
`<Sheet>` blocks render `FeedbackForm`/`SupportForm` inside, mirroring
qkit's `DashboardNav`'s Help/Feedback drawer structure.

### `src/app/admin/page.tsx` (modify)

Extend the existing "Needs attention" section: read open
`merqo.support_messages` rows (team-visible via RLS), render each as a row
alongside the existing waitlist rows (email/category/body preview + a
"Resolve" button), and fold the open-message count into the section's
`attention` total.

### `src/app/admin/actions.ts` (new) + `src/app/admin/resolve-support-message-button.tsx` (new)

`src/app/admin/actions.ts` holds `resolveSupportMessageAction` (team-gated
via `requireMerqoTeam()`, updates `status = 'resolved'` via the service
client, `revalidatePath("/admin")`) — a new top-level admin actions file,
since this action belongs to the Overview page itself rather than any of
the existing per-section directories (`admin/vendors/actions.ts`,
`admin/team/actions.ts`). `resolve-support-message-button.tsx` is a small
client component calling it, ported from qkit's `ResolveMessageButton`.

### `src/lib/nps.ts` (new)

Ported verbatim from qkit's `src/lib/nps.ts` — `npsBreakdown(scores: number[]): { total, promoters, passives, detractors, score }`, a pure function
(promoters 9–10, passives 7–8, detractors 0–6, `score = round((promoters -
detractors) / total * 100)`, `null` when `total` is 0). Extracted as its own
tested unit rather than inlined in the page, matching this codebase's
established pure-function convention (`computeTrend`, `classifyHealth`,
etc.).

### `src/app/admin/feedback/page.tsx` (new) + `src/app/admin/admin-nav.tsx` (modify)

New tab `{ href: "/admin/feedback", label: "Feedback" }` added to `AdminNav`'s
`TABS`. The new page reads `merqo.feedback` (team-only via RLS), calls
`npsBreakdown()` on the `nps` column, and lists comments — the same shape as
qkit's "Vendor NPS" section, with qkit's Platform CSAT and per-vendor CSAT
sections dropped entirely (no customers/booths to compute them from).

## Error handling

Both Server Actions return `ActionResult` (existing convention) —
`safeParse()` failure or a missing session surfaces a friendly error via
`toast.error()` in the calling form, matching `SupportForm`/`FeedbackForm`'s
existing qkit-ported error handling. An insert failure (RLS reject, DB
error) is caught and returns a generic "Could not send" message, logged
server-side via `console.error()` — matches qkit's own actions verbatim.

## Testing

- `src/lib/feedback-support-schemas.ts`: unit tests for both schemas
  (valid input, empty body rejected, NPS out of range rejected, message
  length cap).
- `submitSupportMessageAction`/`submitFeedbackAction`: unit tests mocking
  the Supabase client, mirroring the existing `join-waitlist.ts` test's
  mocking style (`vi.hoisted()` + `vi.mock("@/lib/supabase/server")`).
- `SupportForm`/`FeedbackForm`: DOM tests — category selection, NPS grid
  selection, validation error surfacing, success state.
- `resolveSupportMessageAction`: unit test mocking the service client.
- `AccountMenu`: extend existing tests — both new items open their Sheet,
  "Contact Merqo" no longer present.
- `src/lib/nps.ts`: unit tests for `npsBreakdown` (empty input → `score:
null`, all-promoters, all-detractors, a mixed set matching a hand-computed
  score, out-of-range/non-finite inputs skipped).
- `/admin/feedback` page and the `/admin` Overview page's support-message
  rendering: no colocated test, per this codebase's established convention
  (Server Component pages aren't directly unit-tested — the pure
  `npsBreakdown` computation they call is what's actually tested).
- `pnpm check` + `pnpm build` clean in Merqo (the `pnpm build`-specific
  check matters — this session already hit one client/server-boundary CI
  failure that only `pnpm build` catches).

## Open questions

None blocking.
