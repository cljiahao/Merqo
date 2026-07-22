# Cross-Kit Support Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `merqo.support_messages` (today: hub-only, fixed 4-category
enum) into a cross-kit inbox reachable via a new RPC, and wire paykit's
"Get help" (currently a `mailto:` link) to it as the first kit consumer.

**Architecture:** Additive migration in the `merqo` repo (nullable
`kit_slug`, relaxed `category` constraint, new `SECURITY DEFINER`
`submit_support_message` RPC) — same "shared table, RPC-only cross-schema
access" pattern `merqo.vendor_profile` already established. The `merqo`
repo's own admin page and read-model update to surface `kit_slug`. The
`paykit` repo gets a new `SupportForm` (ports qkit's UI shape, paykit's
own category set), a server action, and an RPC-calling helper mirroring
`merqo-vendor-profile.ts`; the dashboard nav's Get-help item swaps from
`mailto:` to a `Sheet` drawer, matching the existing Feedback drawer.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase
Postgres (RLS + `SECURITY DEFINER` RPC), Zod, Vitest + Testing Library —
identical stack in both repos.

## Global Constraints

- This spans two separate git repos (`merqo`, `paykit`) with independent
  CI/branch protection — Tasks 1-3 land and merge in `merqo` first (the
  RPC must exist before paykit's code has anything to call), Tasks 4-9 in
  `paykit` second.
- Neither repo's migration can be applied/verified against a live
  Supabase in this environment (no `.env.local` credentials in this
  sandbox, confirmed repeatedly this session) — migrations are written
  and reviewed, not executed. Say so plainly rather than claiming live
  verification.
- Explicitly out of scope: migrating qkit's own existing local
  `support_messages` table to the shared one. Do not touch the `qkit`
  repo in this plan.
- `pnpm check` and `pnpm test` (run from each repo's own root) must pass
  after every task in that repo.
- Every file this plan touches is listed in the design spec at
  `docs/superpowers/specs/2026-07-23-cross-kit-support-messages-design.md`
  (in the `merqo` repo).

---

### Task 1: Additive migration — `kit_slug`, relaxed `category`, new RPC

**Repo:** `merqo`

**Files:**

- Create: `supabase/migrations/0010_cross_kit_support_messages.sql`

**Interfaces:**

- Consumes: nothing (pure SQL).
- Produces: `merqo.support_messages.kit_slug` (nullable text),
  `merqo.submit_support_message(p_kit_slug text, p_category text, p_body
text) returns merqo.support_messages` — Task 2 (`support.ts`) selects
  the new column; paykit's Task 6 (`merqo-support.ts`) calls this RPC by
  this exact name and argument names.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0010_cross_kit_support_messages.sql`:

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

- [ ] **Step 2: Review, don't execute**

This environment has no live Supabase connection. Re-read the SQL once
for syntax sanity against `0007_feedback_and_support.sql`'s and
`0009_vendor_profile.sql`'s own style (lowercase keywords, `merqo.`
schema-qualified names, `security definer set search_path = ''`). Confirm
the dropped constraint name — `support_messages_category_check` — matches
Postgres's default auto-naming for an unnamed inline
`CHECK (category IN (...))` on table `support_messages`, column
`category` (`<table>_<column>_check`), which it does. Move on; this gets
applied for real the next time `merqo` deploys against the shared
Supabase project.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_cross_kit_support_messages.sql
git commit -m "feat: extend support_messages into a cross-kit inbox"
```

---

### Task 2: `support.ts` — surface `kit_slug`, loosen `category` typing

**Repo:** `merqo`

**Files:**

- Modify: `src/lib/support.ts`

**Interfaces:**

- Consumes: the `kit_slug` column (Task 1).
- Produces: `OpenSupportMessage` with `kit_slug: string | null` and
  `category: string` — Task 3 (`admin/page.tsx`) renders both.

- [ ] **Step 1: Update `OpenSupportMessage` and the select/map**

Replace the full contents of `src/lib/support.ts`:

```ts
import { createServiceClient } from "@/lib/supabase/server";

export type OpenSupportMessage = {
  id: string;
  email: string | null;
  kit_slug: string | null;
  category: string;
  body: string;
  created_at: string;
};

/** Open support messages, oldest first, with the submitter's email resolved
 *  via the admin API (support_messages has no email column — same pattern
 *  as admin.ts's listTeamMembers). Gate callers with requireMerqoTeam().
 *  `category` is a plain string, not a fixed enum — since 2026-07-23 any
 *  kit can write its own category vocabulary through the shared
 *  submit_support_message RPC (see the cross-kit-support-messages design
 *  spec); this read model no longer assumes the hub's own 4 categories. */
export async function listOpenSupportMessages(): Promise<OpenSupportMessage[]> {
  const supabase = await createServiceClient();
  const [messagesRes, usersRes] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, user_id, kit_slug, category, body, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (messagesRes.error) {
    throw new Error(`support messages read: ${messagesRes.error.message}`);
  }
  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );
  return (messagesRes.data ?? []).map((m) => ({
    id: m.id as string,
    email: emailById.get(m.user_id as string) ?? null,
    kit_slug: m.kit_slug as string | null,
    category: m.category as string,
    body: m.body as string,
    created_at: m.created_at as string,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: FAILS in `src/app/admin/page.tsx` (still imports/uses
`SUPPORT_CATEGORY_LABELS[m.category]`, now a type error since `category`
is `string`, not the narrow enum `SUPPORT_CATEGORY_LABELS` is keyed on).
This is expected — Task 3 fixes it.

- [ ] **Step 3: Commit** — deferred to Task 3 (repo won't typecheck clean
      until then). Continue immediately to Task 3.

---

### Task 3: `admin/page.tsx` — display raw category + kit badge

**Repo:** `merqo`

**Files:**

- Modify: `src/app/admin/page.tsx`

**Interfaces:**

- Consumes: `OpenSupportMessage` (Task 2).
- Produces: nothing consumed elsewhere — leaf UI.

- [ ] **Step 1: Replace the category-label lookup**

In `src/app/admin/page.tsx`, remove the now-unused import:

```ts
import { SUPPORT_CATEGORY_LABELS } from "@/lib/feedback-support-schemas";
```

Find:

```tsx
{
  openSupport.map((m) => (
    <div
      key={m.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{m.email ?? "Unknown"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {SUPPORT_CATEGORY_LABELS[m.category]} — {m.body}
        </p>
      </div>
      <ResolveSupportMessageButton id={m.id} />
    </div>
  ));
}
```

Replace with:

```tsx
{
  openSupport.map((m) => (
    <div
      key={m.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{m.email ?? "Unknown"}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {m.kit_slug ?? "merqo"}
          </span>{" "}
          · {m.category} — {m.body}
        </p>
      </div>
      <ResolveSupportMessageButton id={m.id} />
    </div>
  ));
}
```

- [ ] **Step 2: Full-repo typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors — Task 1-3's cumulative changes make the repo compile
again (Task 2's Step 2 intentionally left it broken).

- [ ] **Step 3: Full check and test**

Run: `pnpm check && pnpm test`
Expected: both pass clean. If `pnpm check` flags formatting, run
`pnpm format` and re-run.

- [ ] **Step 4: Commit everything from Tasks 1-3 together**

```bash
git add supabase/migrations/0010_cross_kit_support_messages.sql src/lib/support.ts src/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat: cross-kit support inbox — kit_slug + RPC + admin display

Extends merqo.support_messages beyond hub-only categories so any kit
can file a message through the new submit_support_message RPC, same
RPC-only cross-schema pattern merqo.vendor_profile already established.
paykit is the first kit wired up (separate paykit-repo commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push and open a PR (same protected-main flow as paykit)**

```bash
git checkout -b feat/cross-kit-support-messages
git push -u origin feat/cross-kit-support-messages
gh pr create --title "feat: cross-kit support messages (kit_slug + RPC)" --body "$(cat <<'EOF'
## Summary
- Extends merqo.support_messages with a nullable kit_slug and a new
  merqo.submit_support_message RPC so any kit can file a support
  message through the shared inbox, not just Merqo hub itself.
- Admin page shows the raw category + which kit a message is from.

## Test plan
- [x] pnpm check clean
- [x] pnpm test passing
- [ ] Migration applied and verified against a live Supabase project
      (not possible in the authoring sandbox — flag for whoever deploys)
EOF
)"
```

Wait for CI, then merge once green (same process as paykit's PR #1: check
`gh pr checks`, merge with `gh pr merge --squash`, re-sync local `main`
with `git checkout -B main origin/main` if `gh pr merge`'s own local
fast-forward fails — do not use `git reset --hard`, it's harness-blocked).

**Do not proceed to Task 4 until this PR is merged** — paykit's code
calls this RPC by name; it must exist first.

---

### Task 4: paykit — `supportMessageSchema` + labels

**Repo:** `paykit`

**Files:**

- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/schemas.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `supportMessageSchema`, `SupportMessageInput`,
  `SUPPORT_CATEGORY_LABELS` — Task 7 (`actions/support.ts`) and Task 8
  (`SupportForm`) both import these.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/schemas.test.ts` (new `describe` block, alongside the
existing ones):

```ts
describe("supportMessageSchema", () => {
  it("accepts a valid payment-category message", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "payment",
      body: "My QR isn't generating.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "payment",
      body: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "not-a-real-category",
      body: "Help",
    });
    expect(parsed.success).toBe(false);
  });
});
```

Add `supportMessageSchema` to the existing `import { ... } from "./schemas"` line at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: FAIL — `supportMessageSchema` is not exported by `./schemas` yet.

- [ ] **Step 3: Write minimal implementation**

Append to the end of `src/lib/schemas.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: PASS (all existing tests plus the 3 new ones).

- [ ] **Step 5: Commit** — deferred; continue to Task 5 (repo-wide commit
      batching, same reasoning as the freemium-nudge and multi-method-byo
      plans this session — later tasks' files will be added to one clean
      commit once the whole feature compiles and tests pass together).

---

### Task 5: paykit — `merqo-support.ts` RPC helper

**Repo:** `paykit`

**Files:**

- Create: `src/lib/merqo-support.ts`

**Interfaces:**

- Consumes: nothing new (Supabase client generics, same pattern as
  `merqo-vendor-profile.ts`).
- Produces: `submitSupportMessage(supabase, category, body): Promise<void>`
  — Task 7 (`actions/support.ts`) calls this.

- [ ] **Step 1: Write the helper**

Create `src/lib/merqo-support.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_support_message RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside paykit's
 * own supabase gen types scope (schema: "paykit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-design.md.
 */
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

/**
 * Callers pass in a client already scoped to their own (paykit) Database
 * and schema name — same generic-over-caller's-client pattern as
 * merqo-vendor-profile.ts, for the same reason (a bare SupabaseClient
 * defaults its schema-name param to "public", which a real caller scoped
 * to "paykit" doesn't structurally match).
 */
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

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors from this file (it has no consumers yet, so
nothing exercises it — this is a compile-sanity check, not a behavior
test; Task 7's test is where this function's actual behavior gets
covered, via a mocked Supabase client, matching how `merqo-vendor-profile.ts`
itself has no dedicated test file — its behavior is covered through its
callers, e.g. `profile/actions.test.ts`).

- [ ] **Step 3: Commit** — deferred; continue to Task 6.

---

### Task 6: paykit — `actions/support.ts` server action

**Repo:** `paykit`

**Files:**

- Create: `src/app/actions/support.ts`
- Create: `src/app/actions/support.test.ts`

**Interfaces:**

- Consumes: `supportMessageSchema` (Task 4), `submitSupportMessage`
  (Task 5), `getVendorSession` (existing, `@/lib/vendor-session`),
  `ActionResult` (existing, `@/lib/action-result`).
- Produces: `submitSupportMessageAction(input: unknown):
Promise<ActionResult>` — Task 8 (`SupportForm`) calls this.

- [ ] **Step 1: Check whether `src/app/actions/` already exists**

Run: `ls src/app/actions 2>&1 || echo "does not exist"`
If it doesn't exist yet, this task creates the directory implicitly by
creating the file in it — no separate step needed, Next.js/the filesystem
handles this.

- [ ] **Step 2: Write the failing test**

Create `src/app/actions/support.test.ts`:

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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  rpcMock.mockReset().mockResolvedValue({ data: { id: "msg1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitSupportMessageAction", () => {
  it("calls the RPC with the vendor's category and body", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "payment",
      body: "My QR isn't generating.",
    });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_support_message", {
      p_kit_slug: "paykit",
      p_category: "payment",
      p_body: "My QR isn't generating.",
    });
  });

  it("returns an error for an empty body without calling the RPC", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "payment",
      body: "",
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "payment",
      body: "Help",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/connection reset/);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/app/actions/support.test.ts`
Expected: FAIL — `./support` doesn't exist yet.

- [ ] **Step 4: Write minimal implementation**

Create `src/app/actions/support.ts`:

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
  } catch (err) {
    console.error(
      "submitSupportMessageAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/app/actions/support.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit** — deferred; continue to Task 7.

---

### Task 7: paykit — `SupportForm` component

**Repo:** `paykit`

**Files:**

- Create: `src/components/support-form.tsx`
- Create: `src/components/support-form.dom.test.tsx`

**Interfaces:**

- Consumes: `submitSupportMessageAction` (Task 6),
  `SUPPORT_CATEGORY_LABELS`/`SupportMessageInput` (Task 4).
- Produces: `<SupportForm />` — Task 8 (`dashboard-nav.tsx`) renders it
  inside the Get-help `Sheet`.

- [ ] **Step 1: Write the failing test**

Create `src/components/support-form.dom.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportForm } from "./support-form";

const { submitSupportMessageActionMock } = vi.hoisted(() => ({
  submitSupportMessageActionMock: vi.fn(),
}));

vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: submitSupportMessageActionMock,
}));

beforeEach(() => {
  submitSupportMessageActionMock.mockReset();
});

describe("SupportForm", () => {
  it("shows an error and does not submit when the body is empty", async () => {
    const user = userEvent.setup();
    render(<SupportForm />);
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(submitSupportMessageActionMock).not.toHaveBeenCalled();
  });

  it("submits the selected category and typed body, shows a sent confirmation", async () => {
    submitSupportMessageActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<SupportForm />);

    await user.click(screen.getByRole("radio", { name: /pro plan/i }));
    await user.type(
      screen.getByLabelText(/describe the problem/i),
      "My plan didn't upgrade.",
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(submitSupportMessageActionMock).toHaveBeenCalledWith({
        category: "billing",
        body: "My plan didn't upgrade.",
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/we'll look into this/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/support-form.dom.test.tsx`
Expected: FAIL — `./support-form` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/support-form.tsx`, porting qkit's own
`support-form.tsx` shape against paykit's category set:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { submitSupportMessageAction } from "@/app/actions/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";
import type { SupportMessageInput } from "@/lib/schemas";

const CATEGORIES: { value: SupportMessageInput["category"]; label: string }[] =
  Object.entries(SUPPORT_CATEGORY_LABELS).map(([value, label]) => ({
    value: value as SupportMessageInput["category"],
    label,
  }));

/**
 * Vendor → Merqo team help request. Sits in a Sheet off the account menu,
 * mirroring the feedback widget — see qkit's own src/components/support-form.tsx,
 * this is the same shape against paykit's own category set.
 */
export function SupportForm() {
  const [category, setCategory] =
    useState<SupportMessageInput["category"]>("payment");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim()) {
      toast.error("Tell us what's wrong");
      return;
    }
    start(async () => {
      const res = await submitSupportMessageAction({
        category,
        body: body.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        Got it. We&apos;ll look into this and follow up.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="mb-2 text-sm font-medium">What&apos;s it about?</p>
        <ToggleGroup
          type="single"
          value={category}
          onValueChange={(v) =>
            v && setCategory(v as SupportMessageInput["category"])
          }
          aria-label="What's it about?"
          className="grid grid-cols-2"
        >
          {CATEGORIES.map((c) => (
            <ToggleGroupItem
              key={c.value}
              value={c.value}
              className={cn(
                "rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5",
                "data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
              )}
            >
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Describe the problem"
        placeholder="What happened? The more detail, the faster we can help."
        rows={4}
        maxLength={2000}
        className="rounded-lg text-sm"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={send}
        disabled={pending}
      >
        {pending ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Check whether `ToggleGroup`/`Textarea` shadcn primitives exist**

Run: `ls src/components/ui/toggle-group.tsx src/components/ui/textarea.tsx 2>&1`
If either is missing, install via the project's shadcn CLI convention
(check `components.json` for the configured registry) before proceeding
— do not hand-write a substitute primitive.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/support-form.dom.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit** — deferred; continue to Task 8.

---

### Task 8: paykit — wire `dashboard-nav.tsx`'s Get-help to the Sheet

**Repo:** `paykit`

**Files:**

- Modify: `src/app/dashboard/dashboard-nav.tsx`
- Modify: `src/app/dashboard/dashboard-nav.dom.test.tsx`

**Interfaces:**

- Consumes: `<SupportForm />` (Task 7).
- Produces: nothing consumed elsewhere — leaf UI wiring.

- [ ] **Step 1: Write the failing test**

In `src/app/dashboard/dashboard-nav.dom.test.tsx`, mock the new component
and add a test. Add near the top, alongside other setup:

```ts
vi.mock("@/components/support-form", () => ({
  SupportForm: () => <div data-testid="support-form" />,
}));
```

Add a new test inside the `describe("DashboardNav", ...)` block:

```tsx
it("Get help opens a Sheet with the support form, not a mailto link", async () => {
  const user = userEvent.setup();
  render(<DashboardNav {...baseProps} />);
  await user.click(screen.getByRole("button", { name: /account menu/i }));

  const getHelp = screen.getByRole("menuitem", { name: "Get help" });
  expect(getHelp.tagName).not.toBe("A");

  await user.click(getHelp);
  expect(screen.getByTestId("support-form")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/dashboard-nav.dom.test.tsx`
Expected: FAIL — Get-help is still a `mailto:` `<a>` and no support-form
Sheet exists.

- [ ] **Step 3: Write minimal implementation**

In `src/app/dashboard/dashboard-nav.tsx`:

1. Add the import:

```ts
import { SupportForm } from "@/components/support-form";
```

2. Add a `helpOpen` state, alongside the existing `feedbackOpen`:

```ts
const [helpOpen, setHelpOpen] = useState(false);
```

3. Replace the mailto `DropdownMenuItem`:

```tsx
<DropdownMenuItem asChild>
  <a href="mailto:support@merqo.app?subject=paykit%20support">
    <LifeBuoy className="size-4" />
    Get help
  </a>
</DropdownMenuItem>
```

with:

```tsx
<DropdownMenuItem className="cursor-pointer" onSelect={() => setHelpOpen(true)}>
  <LifeBuoy className="size-4" />
  Get help
</DropdownMenuItem>
```

4. Add a Get-help `Sheet`, right before the existing Feedback `Sheet`:

```tsx
<Sheet open={helpOpen} onOpenChange={setHelpOpen}>
  <SheetContent side="right" className="w-full sm:max-w-md">
    <SheetHeader>
      <SheetTitle className="text-2xl">Get help</SheetTitle>
      <SheetDescription>
        Trouble with a payment or your Pro plan? Tell us and we&apos;ll sort it
        out.
      </SheetDescription>
    </SheetHeader>
    <div className="px-4 pb-6">
      <SupportForm />
    </div>
  </SheetContent>
</Sheet>
```

5. Update the file's own top-of-function doc comment — it currently says
   `Get-help is a mailto link (no support-ticket infra in paykit yet — see
the plan's Global Constraints)`; delete that clause, it's no longer
   true.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/dashboard-nav.dom.test.tsx`
Expected: PASS (4 tests: inline links, account-menu order, sign-out form
submit, the new Get-help Sheet test).

- [ ] **Step 5: Commit** — deferred; continue to Task 9.

---

### Task 9: Final verification, docs, spec/plan commit, push

**Repo:** `paykit`

**Files:**

- Modify: `AGENTS.md` (data-model/rules section, if it mentions the
  mailto interim pattern — check and update)
- Modify: `docs/business/2026-07-21-dashboard-nav-standard.md` — wait,
  this file lives in `Merqo Business/docs/`, a shared, non-git-repo
  folder (confirmed earlier this session) — update its "Get help" section
  and the paykit row of its application checklist directly; no commit
  needed for that folder, it's not a git repo.
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full-repo check and test**

Run: `pnpm check && pnpm test`
Expected: both pass clean.

- [ ] **Step 2: Confirm no leftover mailto reference**

Run: `grep -rn "mailto:support@merqo" src`
Expected: no output.

- [ ] **Step 3: Update `Merqo Business/docs/business/2026-07-21-dashboard-nav-standard.md`**

Read the file first. Update §2 item 4 ("Get help") to note paykit has
moved off the mailto interim pattern to the real Sheet/`SupportForm`
pattern, and update the paykit row of the "Application checklist" table
accordingly (remove the "(mailto, interim)" qualifier for paykit).

- [ ] **Step 4: Update `CHANGELOG.md`**

Add an entry under `## [Unreleased]` → `### Added`:

```md
- **Real "Get help" support form**, replacing the mailto-link interim
  pattern — files into the shared cross-kit `merqo.support_messages`
  inbox (Merqo team picks it up in `/admin`), same pattern qkit's own
  local support form uses, now shared infrastructure any kit can call.
```

- [ ] **Step 5: Commit everything from Tasks 4-9 together**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/lib/merqo-support.ts src/app/actions/support.ts src/app/actions/support.test.ts src/components/support-form.tsx src/components/support-form.dom.test.tsx src/app/dashboard/dashboard-nav.tsx src/app/dashboard/dashboard-nav.dom.test.tsx CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: real Get-help support form, wired to the shared cross-kit inbox

Replaces the mailto interim pattern. Requires merqo's
submit_support_message RPC (separate merqo-repo PR, must be merged
first — see docs/superpowers/plans/2026-07-23-cross-kit-support-messages.md
in the merqo repo).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open a PR**

```bash
git checkout -b feat/support-form-cross-kit
git push -u origin feat/support-form-cross-kit
gh pr create --title "feat: real Get-help support form (cross-kit inbox)" --body "$(cat <<'EOF'
## Summary
- Replaces the mailto Get-help link with a real Sheet form, filing into
  the shared merqo.support_messages inbox via the new
  merqo.submit_support_message RPC.
- Depends on the merqo-repo PR (submit_support_message RPC) already
  being merged — this PR's code will fail at runtime (not at build/test
  time, since tests mock the RPC) until that's live.

## Test plan
- [x] pnpm check clean
- [x] pnpm test passing
EOF
)"
```

Wait for CI (`gh pr checks <n>`), merge once green
(`gh pr merge <n> --squash --delete-branch`), re-sync local `main` with
`git checkout -B main origin/main` if the local fast-forward step fails
(same as PR #1's merge) — never `git reset --hard`, it's harness-blocked.
