# Cross-Kit Support Messages — Remaining Kits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give loopkit and stockkit a real "Get help" flow (replacing their
`mailto:` links) backed by the already-shipped `merqo.submit_support_message`
RPC, and converge qkit's existing local `support_messages` system onto the
same shared table.

**Architecture:** loopkit/stockkit each get a new `merqo-support.ts` RPC
wrapper, a `submitSupportMessageAction`, a `SupportForm`, and a
`dashboard-nav.tsx` Sheet — all ported verbatim from paykit's already-shipped
pattern, against each kit's own category set. qkit's existing submit action
swaps its local insert for the same RPC; its admin resolve/read paths move
from its own local table to `merqo.support_messages` via its existing
service-role client (no new merqo-side RPC needed for that half).

**Tech Stack:** Next.js · Supabase (Postgres, `SECURITY DEFINER` RPC already
live) · Zod · Vitest · React Testing Library · TypeScript strict, across 3
repos: `loopkit`, `stockkit`, `qkit`.

## Global Constraints

- Full design: `docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md`
  (merqo repo). Read it before starting if anything below is ambiguous.
- `merqo.submit_support_message(p_kit_slug text, p_category text, p_body
text)` already exists and is already live — no merqo-repo changes in this
  plan at all.
- New qkit migration file: `supabase/migrations/0072_support_messages_convergence.sql`
  (0071 is qkit's own vendor-feedback-convergence migration, landing in a
  separate, independent plan — if that plan hasn't merged yet when this one
  starts, number this migration `0071` instead and adjust; either order is
  fine, they don't depend on each other).
- **Branch protection is active on all 3 repos** — no direct push to
  `main`. Land via a feature branch, a PR, passing required CI checks, then
  `gh pr merge --squash --delete-branch`. Group into 3 PRs, one per repo.
- Quote style: loopkit and qkit use double quotes; stockkit uses single
  quotes (matches its own existing files).
- Run each repo's own `pnpm check` and `pnpm test` before every commit.

---

## Task 1: loopkit — RPC wrapper, schema, and action

**Files:**

- Create: `src/lib/merqo-support.ts`
- Modify: `src/lib/schemas.ts`
- Create: `src/app/actions/support.ts`
- Create: `src/app/actions/support.test.ts`
- Modify: `src/lib/README.md`
- Modify: `src/app/actions/README.md`

**Interfaces:**

- Consumes: `merqo.submit_support_message` (already live).
- Produces: `submitSupportMessageAction(input: unknown): Promise<ActionResult>`
  — Task 2 renders a form that calls this.

- [ ] **Step 1: Write the RPC wrapper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_support_message RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside loopkit's
 * own supabase gen types scope (schema: "loopkit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md.
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
      p_kit_slug: "loopkit",
      p_category: category,
      p_body: body,
    });
  if (error) {
    throw new Error(`submit_support_message failed: ${error.message}`);
  }
}
```

- [ ] **Step 2: Add the schema, alongside the existing `feedbackSchema`**

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

- [ ] **Step 3: Write the failing action test**

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
  rpcMock.mockReset().mockResolvedValue({ data: { id: "msg1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitSupportMessageAction", () => {
  it("calls the RPC with loopkit's kit slug, category, and body", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "program",
      body: "Stamps aren't crediting.",
    });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_support_message", {
      p_kit_slug: "loopkit",
      p_category: "program",
      p_body: "Stamps aren't crediting.",
    });
  });

  it("returns an error for an empty body without calling the RPC", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "program",
      body: "",
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns an error without redirecting when there's no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "program",
      body: "Help",
    });
    expect(result).toEqual({
      success: false,
      error: "Please sign in first",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "program",
      body: "Help",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/connection reset/);
    }
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: FAIL — `./support` doesn't exist yet.

- [ ] **Step 5: Write the action**

```ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { supportMessageSchema } from "@/lib/schemas";
import { submitSupportMessage } from "@/lib/merqo-support";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submit a vendor's Get-help message into the shared cross-kit
 * merqo.support_messages inbox via merqo.submit_support_message. Inline
 * session check, not the shared vendor-auth guard — this action backs a
 * Sheet-embedded widget off the dashboard nav, not a full page, same
 * reasoning feedback.ts already established.
 */
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

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

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

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: 4 tests, all PASS.

- [ ] **Step 7: Update `src/lib/README.md`**

Add one bullet, alphabetically placed right after the `merqo-vendor-feedback.ts`
bullet:

```markdown
- `merqo-support.ts` — `submitSupportMessage`: hand-written mirror of merqo's cross-schema `submit_support_message` RPC contract, generic over the caller's own `Database`/schema; the write path used by `actions/support.ts` for the Get-help Sheet.
```

- [ ] **Step 8: Update `src/app/actions/README.md`**

Add a bullet for `support.ts` (and `support.test.ts`), following the same
format as the existing `feedback.ts` bullet in this file.

- [ ] **Step 9: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git checkout -b feat/support-messages-cross-kit
git add src/lib/merqo-support.ts src/lib/schemas.ts src/app/actions/support.ts src/app/actions/support.test.ts src/lib/README.md src/app/actions/README.md
git commit -m "feat: add loopkit Get-help support message submission"
```

---

## Task 2: loopkit — SupportForm + dashboard-nav Sheet

**Files:**

- Create: `src/components/support-form.tsx`
- Create: `src/components/support-form.dom.test.tsx`
- Modify: `src/app/dashboard/dashboard-nav.tsx`
- Modify: `src/app/dashboard/dashboard-nav.dom.test.tsx`

**Interfaces:**

- Consumes: `submitSupportMessageAction` (Task 1),
  `SUPPORT_CATEGORY_LABELS`/`SupportMessageInput` (Task 1).

- [ ] **Step 1: Write the failing component test**

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

Run: `pnpm exec vitest run src/components/support-form.dom.test.tsx`
Expected: FAIL — `./support-form` doesn't exist yet.

- [ ] **Step 3: Write the component**

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
 * Vendor -> Merqo team help request. Sits in a Sheet off the account menu,
 * mirroring the feedback widget — see paykit's own
 * src/components/support-form.tsx, this is the same shape against
 * loopkit's own category set.
 */
export function SupportForm() {
  const [category, setCategory] =
    useState<SupportMessageInput["category"]>("program");
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/support-form.dom.test.tsx`
Expected: 2 tests, all PASS.

- [ ] **Step 5: Update `dashboard-nav.tsx`**

Add `helpOpen` state next to the existing `feedbackOpen` state (line 112):

```ts
const [helpOpen, setHelpOpen] = useState(false);
```

Add the `SupportForm` import next to the existing `FeedbackForm` import:

```ts
import { SupportForm } from "@/components/support-form";
```

Replace the `mailto:` `DropdownMenuItem` (lines 207-212):

```tsx
<DropdownMenuItem asChild>
  <a href="mailto:support@merqo.app?subject=loopkit%20support">
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

Add a `helpOpen` Sheet as a sibling of the existing `feedbackOpen` Sheet, at
the bottom of the component (right before the closing `</div>`):

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

- [ ] **Step 6: Update `dashboard-nav.dom.test.tsx`**

Add a mock for the new component, next to the existing `feedback` action
mock:

```ts
vi.mock("@/components/support-form", () => ({
  SupportForm: () => <div data-testid="support-form" />,
}));
```

Replace the `"links Get help to a mailto address"` test with:

```tsx
it("Get help opens a Sheet with the support form, not a mailto link", async () => {
  const user = userEvent.setup();
  render(<DashboardNav {...baseProps} />);
  await user.click(screen.getByRole("button", { name: /account menu/i }));

  const getHelp = screen.getByRole("menuitem", { name: /get help/i });
  expect(getHelp.querySelector("a")).toBeNull();

  await user.click(getHelp);
  expect(screen.getByTestId("support-form")).toBeInTheDocument();
});
```

(`baseProps` doesn't exist as a named object in this file today — inline
the same props each existing test already passes, e.g. `{...baseProps}`
above should read `signOut={vi.fn(async () => {})} email="vendor@example.com"
vendorName="Kopi Corner" avatarUrl={null} tier="free"`, matching every other
test in this file.)

The existing `"account menu has Profile, Settings, Plan, Get help, Feedback,
then Sign out, in order"` test needs no change — `Get help` is still a
`menuitem` at the same position, only its click behavior changed.

- [ ] **Step 7: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit, push, open PR, merge**

```bash
git add src/components/support-form.tsx src/components/support-form.dom.test.tsx src/app/dashboard/dashboard-nav.tsx src/app/dashboard/dashboard-nav.dom.test.tsx
git commit -m "feat: replace loopkit's Get-help mailto link with a real support form"
git push -u origin feat/support-messages-cross-kit
gh pr create --title "feat: loopkit Get-help via the shared cross-kit support inbox" --body "Adds a real Get-help Sheet (form + Sheet + RPC wrapper), replacing the mailto: link, backed by the already-shipped merqo.submit_support_message RPC. See merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Task 3: stockkit — RPC wrapper, schema, and action

**Files:**

- Create: `src/lib/merqo-support.ts`
- Modify: `src/lib/schemas.ts`
- Create: `src/app/actions/support.ts`
- Create: `src/app/actions/support.test.ts`
- Modify: `src/lib/README.md`

Same shape as Task 1, single-quoted per stockkit's own style, three
categories only (no `billing` — stockkit has no Pro/vendor-tier concept).

- [ ] **Step 1: Write the RPC wrapper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_support_message RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside stockkit's
 * own supabase gen types scope (schema: "stockkit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md.
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
      p_kit_slug: "stockkit",
      p_category: category,
      p_body: body,
    });
  if (error) {
    throw new Error(`submit_support_message failed: ${error.message}`);
  }
}
```

- [ ] **Step 2: Add the schema**

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

- [ ] **Step 3: Write the failing action test**

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
  rpcMock.mockReset().mockResolvedValue({ data: { id: "msg1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitSupportMessageAction", () => {
  it("calls the RPC with stockkit's kit slug, category, and body", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "products",
      body: "Stock count is wrong.",
    });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_support_message", {
      p_kit_slug: "stockkit",
      p_category: "products",
      p_body: "Stock count is wrong.",
    });
  });

  it("returns an error for an empty body without calling the RPC", async () => {
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "products",
      body: "",
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns an error without redirecting when there's no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "products",
      body: "Help",
    });
    expect(result).toEqual({
      success: false,
      error: "Please sign in first",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { submitSupportMessageAction } = await import("./support");
    const result = await submitSupportMessageAction({
      category: "products",
      body: "Help",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/connection reset/);
    }
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: FAIL — `./support` doesn't exist yet.

- [ ] **Step 5: Write the action**

```ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { supportMessageSchema } from "@/lib/schemas";
import { submitSupportMessage } from "@/lib/merqo-support";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submit a vendor's Get-help message into the shared cross-kit
 * merqo.support_messages inbox via merqo.submit_support_message. Inline
 * session check, not a shared vendor-auth guard — this action backs a
 * Sheet-embedded widget off the dashboard nav, not a full page.
 */
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

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

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

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: 4 tests, all PASS.

- [ ] **Step 7: Update `src/lib/README.md`**

Same style addition as loopkit's Task 1 Step 7, adapted to stockkit's own
README paragraph format (a prose paragraph, not a bulleted list — see the
existing file for the exact format to extend).

- [ ] **Step 8: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git checkout -b feat/support-messages-cross-kit
git add src/lib/merqo-support.ts src/lib/schemas.ts src/app/actions/support.ts src/app/actions/support.test.ts src/lib/README.md
git commit -m "feat: add stockkit Get-help support message submission"
```

---

## Task 4: stockkit — SupportForm + dashboard-nav Sheet

**Files:**

- Create: `src/components/support-form.tsx`
- Create: `src/components/support-form.dom.test.tsx`
- Modify: `src/app/dashboard/dashboard-nav.tsx`
- Modify: `src/app/dashboard/dashboard-nav.dom.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

    await user.click(screen.getByRole("radio", { name: /account/i }));
    await user.type(
      screen.getByLabelText(/describe the problem/i),
      "Can't sign in.",
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(submitSupportMessageActionMock).toHaveBeenCalledWith({
        category: "account",
        body: "Can't sign in.",
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/we'll look into this/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/support-form.dom.test.tsx`
Expected: FAIL — `./support-form` doesn't exist yet.

- [ ] **Step 3: Write the component**

Same shape as loopkit's `SupportForm` (Task 2 Step 3), single-quoted, using
`useState<SupportMessageInput['category']>('products')` as the default.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/support-form.dom.test.tsx`
Expected: 2 tests, all PASS.

- [ ] **Step 5: Update `dashboard-nav.tsx`**

Add `helpOpen` state next to `feedbackOpen` (line 50), import `SupportForm`
next to `FeedbackForm`, replace the `mailto:` `DropdownMenuItem` (lines
109-114) with a Sheet-opening one, and add the `helpOpen` Sheet as a
sibling of the existing `feedbackOpen` Sheet — same edit shape as loopkit's
Task 2 Step 5, single-quoted:

```tsx
<Sheet open={helpOpen} onOpenChange={setHelpOpen}>
  <SheetContent side="right" className="w-full sm:max-w-md">
    <SheetHeader>
      <SheetTitle className="text-2xl">Get help</SheetTitle>
      <SheetDescription>
        Trouble with products, stock, or your account? Tell us and we&apos;ll
        sort it out.
      </SheetDescription>
    </SheetHeader>
    <div className="px-4 pb-6">
      <SupportForm />
    </div>
  </SheetContent>
</Sheet>
```

- [ ] **Step 6: Update `dashboard-nav.dom.test.tsx`**

Add the `support-form` mock (mirroring loopkit's Task 2 Step 6) and replace
the existing `'account menu has Profile, Get help, Feedback, then Sign out,
with no Plan item'` test's assumption that `Get help` is a link — add a new
test confirming it opens the Sheet:

```tsx
it("Get help opens a Sheet with the support form, not a mailto link", async () => {
  const user = userEvent.setup();
  render(<DashboardNav vendorName="My Stall" />);
  await user.click(screen.getByRole("button", { name: /account menu/i }));

  const getHelp = screen.getByRole("menuitem", { name: /get help/i });
  expect(getHelp.querySelector("a")).toBeNull();

  await user.click(getHelp);
  expect(screen.getByTestId("support-form")).toBeInTheDocument();
});
```

- [ ] **Step 7: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit, push, open PR, merge**

```bash
git add src/components/support-form.tsx src/components/support-form.dom.test.tsx src/app/dashboard/dashboard-nav.tsx src/app/dashboard/dashboard-nav.dom.test.tsx
git commit -m "feat: replace stockkit's Get-help mailto link with a real support form"
git push -u origin feat/support-messages-cross-kit
gh pr create --title "feat: stockkit Get-help via the shared cross-kit support inbox" --body "Adds a real Get-help Sheet (form + Sheet + RPC wrapper), replacing the mailto: link, backed by the already-shipped merqo.submit_support_message RPC. See merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Task 5: qkit — RPC wrapper + backfill migration

**Files:**

- Create: `src/lib/merqo-support.ts`
- Create: `supabase/migrations/0072_support_messages_convergence.sql`
  (renumber to `0071` if the qkit vendor-feedback-convergence plan hasn't
  merged yet — see Global Constraints)

**Interfaces:**

- Consumes: `merqo.submit_support_message` (already live).
- Produces: `submitSupportMessage<Db, SchemaName>(supabase, category,
body)` — Task 6 calls this.

- [ ] **Step 1: Write the RPC wrapper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape of the merqo.submit_support_message RPC — merqo owns this
 * function's real generated types; this is a hand-written mirror of the
 * RPC contract, not a generated type, since merqo.* is outside qkit's own
 * supabase gen types scope (schema: "qkit"). See
 * merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md.
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
      p_kit_slug: "qkit",
      p_category: category,
      p_body: body,
    });
  if (error) {
    throw new Error(`submit_support_message failed: ${error.message}`);
  }
}
```

- [ ] **Step 2: Write the guarded backfill migration**

```sql
-- One-time copy of qkit's existing local support_messages rows into the
-- shared merqo.support_messages table (merqo migration 0010). New
-- submissions go straight to merqo going forward (see
-- src/app/actions/support.ts) — this is a one-time historical copy. See
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

- [ ] **Step 3: Run the full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/qkit-support-messages-convergence
git add src/lib/merqo-support.ts supabase/migrations/0072_support_messages_convergence.sql
git commit -m "feat: add merqo-support wrapper and backfill for qkit support messages"
```

---

## Task 6: qkit — swap the submit action to the shared RPC

**Files:**

- Modify: `src/app/actions/support.ts`
- Modify: `src/app/actions/support.test.ts`

**Interfaces:**

- Consumes: `submitSupportMessage` from `@/lib/merqo-support` (Task 5).

- [ ] **Step 1: Update the test to expect an RPC call instead of a local insert**

Replace the full file content of `src/app/actions/support.test.ts`:

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
  rpcMock.mockReset().mockResolvedValue({ data: { id: "msg1" }, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("submitSupportMessage", () => {
  it("calls the RPC with the signed-in vendor's category and body", async () => {
    const { submitSupportMessage } = await import("./support");
    const result = await submitSupportMessage({
      category: "payment",
      body: "PayNow didn't go through",
    });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("submit_support_message", {
      p_kit_slug: "qkit",
      p_category: "payment",
      p_body: "PayNow didn't go through",
    });
  });

  it("rejects an empty body before calling the RPC", async () => {
    const { submitSupportMessage } = await import("./support");
    const result = await submitSupportMessage({
      category: "pass",
      body: "   ",
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a bad category", async () => {
    const { submitSupportMessage } = await import("./support");
    const result = await submitSupportMessage({
      // @ts-expect-error — exercising the runtime guard
      category: "refund",
      body: "hi",
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("asks the user to sign in when there's no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitSupportMessage } = await import("./support");
    const result = await submitSupportMessage({
      category: "other",
      body: "hey",
    });
    expect(result).toEqual({ success: false, error: "Please sign in first" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { submitSupportMessage } = await import("./support");
    const result = await submitSupportMessage({
      category: "pro",
      body: "help",
    });
    expect(result).toEqual({
      success: false,
      error: "Could not send your message",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: FAIL — the action still calls `.from("support_messages").insert(...)`.

- [ ] **Step 3: Update the action**

Replace the full file content of `src/app/actions/support.ts`:

```ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { supportMessageSchema, type SupportMessageInput } from "@/lib/schemas";
import { submitSupportMessage as submitSupportMessageRpc } from "@/lib/merqo-support";
import type { ActionResult } from "@/lib/action-result";

/**
 * File a help request into the shared cross-kit merqo.support_messages
 * inbox via merqo.submit_support_message, keyed to the signed-in vendor;
 * the SECURITY DEFINER RPC is the authorization boundary (it writes
 * auth.uid() itself, never a passed-in value).
 */
export async function submitSupportMessage(
  input: SupportMessageInput,
): Promise<ActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitSupportMessageRpc(
      supabase,
      parsed.data.category,
      parsed.data.body,
    );
  } catch (err) {
    console.error(
      "submitSupportMessage failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}
```

(qkit's existing exported function name is `submitSupportMessage`, not
`submitSupportMessageAction` like the other three kits — keep it unchanged
so `SupportForm`'s existing import in qkit doesn't need to change.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/actions/support.test.ts`
Expected: 5 tests, all PASS.

- [ ] **Step 5: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS. qkit's own `support-form.tsx` (unchanged, still imports
`submitSupportMessage` from this action) is unaffected — its own component
test mocks the action at the module boundary.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/support.ts src/app/actions/support.test.ts
git commit -m "feat: submit qkit support messages to the shared merqo table"
```

---

## Task 7: qkit — converge admin resolve + read to `merqo.support_messages`

**Files:**

- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/actions.test.ts`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**

- Consumes: `merqo.support_messages` (columns `id`, `user_id`, `kit_slug`,
  `category`, `body`, `status`, `created_at`), read/written via qkit's
  existing `createServiceClient()` cast to reach the `merqo` schema.

- [ ] **Step 1: Update the resolve-action test**

In `src/app/admin/actions.test.ts`, the `.from(table)` dispatcher's
`"support_messages"` case needs to move under a `schema("merqo")` call
instead of being dispatched directly, since `resolveSupportMessage`'s query
now goes through `.schema("merqo").from("support_messages")`. Update the
mocked service-client object (the one `vi.hoisted` builds and
`createServiceClient` is mocked to return) to add a `schema` method
alongside its existing `from`:

```ts
schema: (name: string) => {
  if (name !== "merqo") throw new Error(`unexpected schema ${name}`);
  return {
    from: (table: string) => {
      if (table !== "support_messages") {
        throw new Error(`unexpected merqo table ${table}`);
      }
      return {
        update: () => ({
          eq: () => ({
            select: () => ({ maybeSingle: supportMsgUpdateSingle }),
          }),
        }),
      };
    },
  };
},
```

(Add this as a sibling property on the same object literal that already
defines `from: (table: string) => { ... }` for the client mock —
`resolveSupportMessage` is the only action in this file that calls
`.schema(...)`; every other action in the same test file keeps using the
existing `from` dispatcher unchanged.)

Update the three existing `resolveSupportMessage` tests' expectations:
`auditInsert` should still be called with `target_id: VENDOR` (the column
is now `user_id` on the merqo side, but the value read out of the updated
row is the same vendor id, so the assertion text doesn't change, only what
`select("vendor_id")` becomes — see Step 2 below).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/admin/actions.test.ts -t resolveSupportMessage`
Expected: FAIL — `resolveSupportMessage` still queries the client's default
`qkit`-scoped `.from("support_messages")` directly, never calls `.schema(...)`.

- [ ] **Step 3: Update `resolveSupportMessage`**

In `src/app/admin/actions.ts`, replace:

```ts
const supabase = await createServiceClient();
const { data: updated, error } = await supabase
  .from("support_messages")
  .update({ status: "resolved" })
  .eq("id", parsed.data.id)
  .select("vendor_id")
  .maybeSingle();
```

with:

```ts
const supabase = await createServiceClient();
const merqoClient = supabase as unknown as SupabaseClient<Database>;
const { data: updated, error } = await merqoClient
  .schema("merqo")
  .from("support_messages")
  .update({ status: "resolved" })
  .eq("id", parsed.data.id)
  .select("user_id")
  .maybeSingle();
```

Update the subsequent `recordAudit` call's `target_id` to read
`updated.user_id` instead of `updated.vendor_id`:

```ts
await recordAudit(supabase, {
  admin_id: user.id,
  action: "resolve_support_message",
  target_id: updated.user_id,
  detail: { message_id: parsed.data.id },
});
```

Add the `SupabaseClient` import to this file's existing import block:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
```

(`Database` is already imported in this file per the existing
`AuditInsert` type alias — reuse it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/admin/actions.test.ts -t resolveSupportMessage`
Expected: 3 tests, all PASS.

- [ ] **Step 5: Update the admin page's open-messages query**

In `src/app/admin/page.tsx`, replace:

```ts
supabase
  .from("support_messages")
  .select("id, vendor_id, category, body, created_at")
  .eq("status", "open")
  .order("created_at", { ascending: true }),
```

with:

```ts
(supabase as unknown as SupabaseClient<Database>)
  .schema("merqo")
  .from("support_messages")
  .select("id, user_id, category, body, created_at")
  .eq("kit_slug", "qkit")
  .eq("status", "open")
  .order("created_at", { ascending: true }),
```

If this page already imports `SupabaseClient`/`Database` for the
vendor-feedback convergence change (a separate, independent plan touching
the same file), don't duplicate the import — reuse it. If not, add both
imports the same way Task from the vendor-feedback plan does.

Any JSX or downstream code in this page that reads the resulting row's
`vendor_id` field needs updating to `user_id` — grep this file for
`vendor_id` after this change and confirm every read of these
support-message rows uses the new field name (the `licenses`/`payments`
rows queried elsewhere in the same `Promise.all` are unrelated and keep
their own `vendor_id` columns unchanged — only the support-messages rows'
field renamed).

- [ ] **Step 6: Run the full check**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit, push, open PR, merge**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts src/app/admin/page.tsx
git commit -m "feat: converge qkit's admin support inbox to merqo.support_messages"
git push -u origin feat/qkit-support-messages-convergence
gh pr create --title "feat: converge qkit support messages into merqo.support_messages" --body "Swaps qkit's vendor-facing submit path and admin resolve/read paths onto the shared cross-kit inbox, backfilling existing local rows. Requires no merqo-repo changes (RPC already live). See merqo/docs/superpowers/specs/2026-07-23-cross-kit-support-messages-remaining-kits-design.md."
```

Wait for required checks to pass, then `gh pr merge --squash --delete-branch`.

---

## Self-Review

**1. Spec coverage:** every element of the design spec maps to a task —
loopkit's net-new Get-help flow (Tasks 1-2), stockkit's identical net-new
flow (Tasks 3-4), qkit's cutover of an existing system (Tasks 5-7, split
into infra/backfill, submit-path swap, and admin resolve+read swap). paykit
is explicitly out of scope (already shipped) and untouched by every task.

**2. Placeholder scan:** no TBD/TODO; every step shows complete code.

**3. Type consistency:** every `merqo-support.ts` wrapper across the three
kits calls the identical real RPC signature
(`p_kit_slug text, p_category text, p_body text`) with each kit's own
hardcoded `p_kit_slug`. qkit's `resolveSupportMessage`/admin-page column
rename (`vendor_id` -> `user_id`) is applied consistently in both the
action and the page — a reader checking one against the other won't find a
mismatch.

**4. One deliberate divergence from the other three kits, called out
explicitly:** qkit's action keeps its existing exported name
(`submitSupportMessage`, not `submitSupportMessageAction`) since its
existing `SupportForm` already imports it under that name and this plan
does not touch that component — renaming the export would be an
unnecessary, unrequested breaking change to a file this plan has no other
reason to open.
