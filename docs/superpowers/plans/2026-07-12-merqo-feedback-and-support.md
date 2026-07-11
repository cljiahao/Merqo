# Merqo In-App Feedback & Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AccountMenu`'s mailto "Contact Merqo" with two real, qkit-mirrored in-app mechanisms — a Feedback (NPS) Sheet and a Support (categorized) Sheet — writing to new `merqo.feedback`/`merqo.support_messages` tables, with open support messages surfaced in `/admin`'s existing "Needs attention" section and a new `/admin/feedback` NPS page.

**Architecture:** One migration creates both tables with qkit-mirrored RLS (self-insert, self-or-team read, team-only resolve). Two new signed-in Server Actions insert via the session client (no service-role, no rate-limiting RPC — every submitter is authenticated, unlike qkit's anonymous-customer path). Two new form components, ported from qkit's `FeedbackForm`/`SupportForm` and trimmed to Merqo's domain (NPS-only, no stars/booth/customer fields), render inside a newly-ported `Sheet` primitive triggered from two new `AccountMenu` items. On the admin side, a small `listOpenSupportMessages()` lib function (service-role, resolves `user_id` → email like `admin.ts`'s existing `listTeamMembers` does) feeds the Overview page's attention section, and a ported `npsBreakdown()` pure function feeds the new Feedback tab.

**Tech Stack:** Next.js 16 Server/Client Components, Supabase (RLS + session-client inserts), Zod, Vitest + Testing Library, sonner (`toast`, already mounted), Radix `Dialog` (via a new `Sheet` UI primitive — `radix-ui` is already a dependency).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Validate all user input with Zod `safeParse()` at every boundary (AGENTS.md).
- No changes to the existing "Get Help" submenu's per-kit routing behavior — only the "Contact Merqo" mailto item is removed.
- No CSAT/star-rating/booth/customer machinery — `merqo.feedback` is NPS (0–10) + optional message only.
- No rate limiting or `SECURITY DEFINER` RPC on either insert path — every submitter is authenticated, so a plain RLS-scoped `insert` via the session client is sufficient.
- No audit-log entry when a support message is resolved — Merqo has no audit-log infrastructure today.
- No admin-side deletion or reopening of a resolved support message — open → resolved is one-way.
- Run `pnpm build`, not just `pnpm check`, before calling any task done — this session's earlier CI failure was a client-component-imports-a-server-only-module build error that `pnpm check` alone does not catch.

---

### Task 1: Migration — `merqo.support_messages` and `merqo.feedback`

**Files:**

- Create: `supabase/migrations/0007_feedback_and_support.sql`
- Test: `test/db/feedback_and_support.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: the `merqo.support_messages` and `merqo.feedback` tables —
  consumed (via Supabase queries, not a TypeScript import) by Task 4
  (`submitSupportMessageAction`), Task 6 (`submitFeedbackAction`), Task 9
  (`resolveSupportMessageAction`), and Task 10
  (`listOpenSupportMessages`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/db/feedback_and_support.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0007_feedback_and_support.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0007_feedback_and_support migration", () => {
  it("creates support_messages with an open/resolved status check", () => {
    expect(sql).toContain("create table merqo.support_messages");
    expect(sql).toContain("check (status in ('open', 'resolved')");
  });

  it("creates feedback with an nps range check", () => {
    expect(sql).toContain("create table merqo.feedback");
    expect(sql).toContain("check (nps between 0 and 10)");
  });

  it("enables RLS and grants the authenticated role on both tables", () => {
    expect(sql).toContain(
      "alter table merqo.support_messages enable row level security",
    );
    expect(sql).toContain(
      "alter table merqo.feedback enable row level security",
    );
    expect(sql).toContain(
      "grant select, insert, update on merqo.support_messages to authenticated",
    );
    expect(sql).toContain(
      "grant select, insert on merqo.feedback to authenticated",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/db/feedback_and_support.test.ts`
Expected: FAIL — `ENOENT: no such file or directory` (the migration file
doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/0007_feedback_and_support.sql

-- Hub-level help requests, mirroring qkit's own support_messages table
-- (0047_support_messages.sql): a signed-in user reports a problem, the
-- Merqo team resolves it in /admin — no email. Categories cover what Merqo
-- itself owns (vendor access, billing, team membership) plus a catch-all.
CREATE TABLE merqo.support_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL CHECK (category IN ('vendor_access', 'billing', 'team', 'other')),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'resolved')),
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

-- Hub-level NPS + comment, mirroring qkit's own feedback table
-- (0018_feedback.sql) trimmed to what Merqo actually has — no customers, no
-- orders, no booths, so no rating/booth_id/order_number/source columns.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/feedback_and_support.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_feedback_and_support.sql test/db/feedback_and_support.test.ts
git commit -m "feat: add merqo.support_messages and merqo.feedback tables"
```

---

### Task 2: `feedback-support-schemas.ts` — Zod schemas + category labels

**Files:**

- Create: `src/lib/feedback-support-schemas.ts`
- Test: `test/lib/feedback-support-schemas.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `supportMessageSchema`, `SupportMessageInput`, `feedbackSchema`,
  `FeedbackInput`, `SUPPORT_CATEGORY_LABELS: Record<SupportMessageInput["category"], string>`
  — consumed by Task 4/5/6/7 (forms + actions) and Task 10 (admin display).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/feedback-support-schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  supportMessageSchema,
  feedbackSchema,
  SUPPORT_CATEGORY_LABELS,
} from "@/lib/feedback-support-schemas";

describe("supportMessageSchema", () => {
  it("accepts a valid category and body", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "Help",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = supportMessageSchema.safeParse({
      category: "nope",
      body: "Help",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a body over 2000 characters", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "a".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

describe("feedbackSchema", () => {
  it("accepts a valid nps with no message", () => {
    expect(feedbackSchema.safeParse({ nps: 8 }).success).toBe(true);
  });

  it("accepts an nps with a message", () => {
    expect(
      feedbackSchema.safeParse({ nps: 8, message: "Great!" }).success,
    ).toBe(true);
  });

  it("rejects an nps below 0", () => {
    expect(feedbackSchema.safeParse({ nps: -1 }).success).toBe(false);
  });

  it("rejects an nps above 10", () => {
    expect(feedbackSchema.safeParse({ nps: 11 }).success).toBe(false);
  });

  it("rejects a non-integer nps", () => {
    expect(feedbackSchema.safeParse({ nps: 5.5 }).success).toBe(false);
  });
});

describe("SUPPORT_CATEGORY_LABELS", () => {
  it("has a label for every category in the schema", () => {
    expect(Object.keys(SUPPORT_CATEGORY_LABELS).sort()).toEqual(
      ["billing", "other", "team", "vendor_access"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/feedback-support-schemas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/feedback-support-schemas'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/feedback-support-schemas.ts
import { z } from "zod";

export const supportMessageSchema = z.object({
  category: z.enum(["vendor_access", "billing", "team", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  vendor_access: "Vendor access",
  billing: "Billing",
  team: "Team",
  other: "Something else",
};

export const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/feedback-support-schemas.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedback-support-schemas.ts test/lib/feedback-support-schemas.test.ts
git commit -m "feat: add Zod schemas and category labels for feedback/support"
```

---

### Task 3: `nps.ts` — NPS breakdown (ported from qkit)

**Files:**

- Create: `src/lib/nps.ts`
- Test: `test/lib/nps.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `npsBreakdown(scores: number[]): { total: number; promoters: number; passives: number; detractors: number; score: number | null }`
  — consumed by Task 11 (`/admin/feedback` page).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/nps.test.ts
import { describe, it, expect } from "vitest";
import { npsBreakdown } from "@/lib/nps";

describe("npsBreakdown", () => {
  it("returns a null score for no responses", () => {
    expect(npsBreakdown([])).toEqual({
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      score: null,
    });
  });

  it("scores 100 when every response is a promoter", () => {
    expect(npsBreakdown([9, 10, 9]).score).toBe(100);
  });

  it("scores -100 when every response is a detractor", () => {
    expect(npsBreakdown([0, 3, 6]).score).toBe(-100);
  });

  it("computes a mixed score correctly", () => {
    const r = npsBreakdown([9, 10, 7, 2]);
    expect(r).toEqual({
      total: 4,
      promoters: 2,
      passives: 1,
      detractors: 1,
      score: 25,
    });
  });

  it("skips out-of-range or non-finite scores", () => {
    expect(npsBreakdown([11, -1, NaN, 8]).total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/nps.test.ts`
Expected: FAIL — `Cannot find module '@/lib/nps'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/nps.ts

// Net Promoter Score — the vendor→Merqo loyalty metric, ported from qkit's
// own src/lib/nps.ts (the vendor→qkit equivalent). Promoters score 9–10,
// passives 7–8, detractors 0–6. NPS = (%promoters − %detractors), an
// integer from −100 to 100.

export type NpsBreakdown = {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number | null;
};

export function npsBreakdown(scores: number[]): NpsBreakdown {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    if (!Number.isFinite(s) || s < 0 || s > 10) continue;
    if (s >= 9) promoters++;
    else if (s >= 7) passives++;
    else detractors++;
  }
  const total = promoters + passives + detractors;
  const score = total
    ? Math.round(((promoters - detractors) / total) * 100)
    : null;
  return { total, promoters, passives, detractors, score };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/nps.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/nps.ts test/lib/nps.test.ts
git commit -m "feat: add npsBreakdown, ported from qkit's own NPS metric"
```

---

### Task 4: `submitSupportMessageAction`

**Files:**

- Create: `src/app/actions/support.ts`
- Test: `test/lib/support-action.test.ts`

**Interfaces:**

- Consumes: `supportMessageSchema`, `SupportMessageInput` (Task 2),
  `ActionResult` (`src/lib/action-result.ts`).
- Produces: `submitSupportMessageAction(input: SupportMessageInput): Promise<ActionResult>`
  — consumed by Task 5 (`SupportForm`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/support-action.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

const { insertMock, fromMock, getUserMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const getUserMock = vi.fn();
  return { insertMock, fromMock, getUserMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { submitSupportMessageAction } from "@/app/actions/support";

afterEach(() => vi.clearAllMocks());

describe("submitSupportMessageAction", () => {
  it("rejects invalid input before touching Supabase", async () => {
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "",
    });
    expect(res.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({ success: false, error: "Please sign in first" });
  });

  it("inserts the message under the signed-in user's id on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(fromMock).toHaveBeenCalledWith("support_messages");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({ success: true });
  });

  it("returns a friendly error when the insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({
      success: false,
      error: "Could not send your message",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/support-action.test.ts`
Expected: FAIL — `Cannot find module '@/app/actions/support'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/actions/support.ts
"use server";
import { createServerClient } from "@/lib/supabase/server";
import {
  supportMessageSchema,
  type SupportMessageInput,
} from "@/lib/feedback-support-schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * File a hub-level help request for the Merqo team to action in /admin — no
 * email. Inserted via the session client (not service-role): the
 * support_messages_self_insert RLS policy is the authorization boundary
 * here, mirroring qkit's own submitSupportMessage.
 */
export async function submitSupportMessageAction(
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

  const { error } = await supabase.from("support_messages").insert({
    user_id: user.id,
    category: parsed.data.category,
    body: parsed.data.body,
  });
  if (error) {
    console.error("submitSupportMessageAction failed", error.message);
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/support-action.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/support.ts test/lib/support-action.test.ts
git commit -m "feat: add submitSupportMessageAction"
```

---

### Task 5: `SupportForm` component

**Files:**

- Create: `src/components/support-form.tsx`
- Test: `test/components/support-form.test.tsx`

**Interfaces:**

- Consumes: `submitSupportMessageAction` (Task 4), `SupportMessageInput`
  (Task 2).
- Produces: `SupportForm()` (no props) — consumed by Task 8 (`AccountMenu`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/components/support-form.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: vi.fn(),
}));

import { submitSupportMessageAction } from "@/app/actions/support";
import { SupportForm } from "@/components/support-form";

describe("SupportForm", () => {
  it("shows an error and does not submit when the body is empty", () => {
    render(<SupportForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(submitSupportMessageAction).not.toHaveBeenCalled();
  });

  it("submits the selected category and typed body", async () => {
    vi.mocked(submitSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<SupportForm />);
    fireEvent.click(screen.getByRole("radio", { name: "Billing" }));
    fireEvent.change(screen.getByLabelText("Describe the problem"), {
      target: { value: "Can't access qkit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(submitSupportMessageAction).toHaveBeenCalledWith({
        category: "billing",
        body: "Can't access qkit",
      }),
    );
  });

  it("shows the sent confirmation after a successful submit", async () => {
    vi.mocked(submitSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<SupportForm />);
    fireEvent.change(screen.getByLabelText("Describe the problem"), {
      target: { value: "Help" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(
        screen.getByText(/we'll look into this and follow up/i),
      ).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/support-form.test.tsx`
Expected: FAIL — `Cannot find module '@/components/support-form'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/support-form.tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitSupportMessageAction } from "@/app/actions/support";
import {
  SUPPORT_CATEGORY_LABELS,
  type SupportMessageInput,
} from "@/lib/feedback-support-schemas";

const CATEGORIES = (
  Object.keys(SUPPORT_CATEGORY_LABELS) as SupportMessageInput["category"][]
).map((value) => ({ value, label: SUPPORT_CATEGORY_LABELS[value] }));

/** Hub-level vendor/team → Merqo help request. Ported from qkit's own
 *  SupportForm — pick what it's about, say what's wrong; the Merqo team
 *  picks it up on /admin. Sits in a Sheet off the account menu. */
export function SupportForm() {
  const [category, setCategory] =
    useState<SupportMessageInput["category"]>("vendor_access");
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
      <div className="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        Got it — we&apos;ll look into this and follow up.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <p className="mb-2 text-sm font-medium">What&apos;s it about?</p>
        <div
          className="grid grid-cols-2 gap-1.5"
          role="radiogroup"
          aria-label="What's it about?"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                category === c.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Describe the problem"
        placeholder="What happened? The more detail, the faster we can help."
        rows={4}
        maxLength={2000}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

Run: `pnpm vitest run test/components/support-form.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/support-form.tsx test/components/support-form.test.tsx
git commit -m "feat: add SupportForm, ported from qkit"
```

---

### Task 6: `submitFeedbackAction`

**Files:**

- Create: `src/app/actions/feedback.ts`
- Test: `test/lib/feedback-action.test.ts`

**Interfaces:**

- Consumes: `feedbackSchema`, `FeedbackInput` (Task 2), `ActionResult`.
- Produces: `submitFeedbackAction(input: FeedbackInput): Promise<ActionResult>`
  — consumed by Task 7 (`FeedbackForm`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/lib/feedback-action.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

const { insertMock, fromMock, getUserMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const getUserMock = vi.fn();
  return { insertMock, fromMock, getUserMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { submitFeedbackAction } from "@/app/actions/feedback";

afterEach(() => vi.clearAllMocks());

describe("submitFeedbackAction", () => {
  it("rejects invalid input before touching Supabase", async () => {
    const res = await submitFeedbackAction({ nps: 11 });
    expect(res.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await submitFeedbackAction({ nps: 8 });
    expect(res).toEqual({ success: false, error: "Please sign in first" });
  });

  it("inserts the score under the signed-in user's id on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    const res = await submitFeedbackAction({ nps: 8, message: "Great!" });
    expect(fromMock).toHaveBeenCalledWith("feedback");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      nps: 8,
      message: "Great!",
    });
    expect(res).toEqual({ success: true });
  });

  it("inserts a null message when none was provided", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    await submitFeedbackAction({ nps: 8 });
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      nps: 8,
      message: null,
    });
  });

  it("returns a friendly error when the insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await submitFeedbackAction({ nps: 8 });
    expect(res).toEqual({ success: false, error: "Could not send feedback" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/feedback-action.test.ts`
Expected: FAIL — `Cannot find module '@/app/actions/feedback'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/actions/feedback.ts
"use server";
import { createServerClient } from "@/lib/supabase/server";
import {
  feedbackSchema,
  type FeedbackInput,
} from "@/lib/feedback-support-schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submit hub-level Merqo feedback (NPS + optional comment). Inserted via the
 * session client — the feedback_self_insert RLS policy is the authorization
 * boundary, mirroring submitSupportMessageAction.
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

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    nps: parsed.data.nps,
    message: parsed.data.message ?? null,
  });
  if (error) {
    console.error("submitFeedbackAction failed", error.message);
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/feedback-action.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/feedback.ts test/lib/feedback-action.test.ts
git commit -m "feat: add submitFeedbackAction"
```

---

### Task 7: `FeedbackForm` component

**Files:**

- Create: `src/components/feedback-form.tsx`
- Test: `test/components/feedback-form.test.tsx`

**Interfaces:**

- Consumes: `submitFeedbackAction` (Task 6).
- Produces: `FeedbackForm()` (no props) — consumed by Task 8 (`AccountMenu`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/components/feedback-form.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/feedback", () => ({
  submitFeedbackAction: vi.fn(),
}));

import { submitFeedbackAction } from "@/app/actions/feedback";
import { FeedbackForm } from "@/components/feedback-form";

describe("FeedbackForm", () => {
  it("shows an error and does not submit when no score is picked", () => {
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(submitFeedbackAction).not.toHaveBeenCalled();
  });

  it("submits the picked score and no message when none was typed", async () => {
    vi.mocked(submitFeedbackAction).mockResolvedValue({ success: true });
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("radio", { name: "8" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() =>
      expect(submitFeedbackAction).toHaveBeenCalledWith({
        nps: 8,
        message: undefined,
      }),
    );
  });

  it("shows the thank-you message after a successful submit", async () => {
    vi.mocked(submitFeedbackAction).mockResolvedValue({ success: true });
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("radio", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() =>
      expect(screen.getByText(/it helps us improve/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/feedback-form.test.tsx`
Expected: FAIL — `Cannot find module '@/components/feedback-form'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/feedback-form.tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitFeedbackAction } from "@/app/actions/feedback";

/** Hub-level NPS + comment widget → merqo.feedback. Ported from qkit's own
 *  FeedbackForm's NPS branch — Merqo has no orders/booths, so only the
 *  vendor→product loyalty metric (NPS), not the star-rating branch,
 *  applies. Sits in a Sheet off the account menu. */
export function FeedbackForm() {
  const [score, setScore] = useState(-1);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (score < 0) {
      toast.error("Pick a score first");
      return;
    }
    start(async () => {
      const res = await submitFeedbackAction({
        nps: score,
        message: message.trim() || undefined,
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
      <div className="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        Thanks for the feedback — it helps us improve.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">
        How likely are you to recommend Merqo to another business?
      </p>
      <div
        className="grid grid-cols-11 gap-1"
        role="radiogroup"
        aria-label="Recommend score, 0 to 10"
      >
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n}`}
            onClick={() => setScore(n)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border text-sm font-semibold tabular-nums transition-colors",
              score === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Anything else?"
        placeholder="Anything we can improve? (optional)"
        rows={3}
        maxLength={2000}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={send}
        disabled={pending}
      >
        {pending ? "Sending…" : "Send feedback"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/feedback-form.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback-form.tsx test/components/feedback-form.test.tsx
git commit -m "feat: add FeedbackForm, ported from qkit"
```

---

### Task 8: `Sheet` primitive + wire Feedback/Support into `AccountMenu`

**Files:**

- Create: `src/components/ui/sheet.tsx`
- Modify: `src/components/account-menu.tsx`
- Modify: `test/components/account-menu.test.tsx`

**Interfaces:**

- Consumes: `SupportForm` (Task 5), `FeedbackForm` (Task 7).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Add the `Sheet` UI primitive**

```typescript
// src/components/ui/sheet.tsx
"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
```

No colocated test for this file — it's ported boilerplate infrastructure
(a thin Radix `Dialog` wrapper), matching this codebase's convention that
`src/components/ui/*.tsx` primitives (`dropdown-menu.tsx`, `alert-dialog.tsx`,
etc.) have no test files of their own; the AccountMenu tests below exercise
it indirectly.

- [ ] **Step 2: Write the failing tests**

Replace the `it("always shows Profile and a Contact Merqo link", ...)` test
block (lines 87-98 of the current `test/components/account-menu.test.tsx`)
with:

```typescript
  it("always shows a Profile link", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Account menu" }),
    );
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("opens the Feedback sheet when its menu item is selected, and Contact Merqo is gone", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Account menu" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Contact Merqo" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Feedback" }));
    expect(
      screen.getByText(/how's merqo working for you/i),
    ).toBeInTheDocument();
  });

  it("opens the Report a problem sheet when its menu item is selected", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Account menu" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Report a problem" }),
    );
    expect(
      screen.getByText(/something not working, or need help/i),
    ).toBeInTheDocument();
  });

  it("hides the Get help submenu when there are no active kits, but keeps Feedback and Report a problem", () => {
    render(<AccountMenu email="vendor@example.com" />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Account menu" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Get help" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Report a problem" }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: FAIL — "Contact Merqo" is still present (not yet removed);
"Feedback"/"Report a problem" menu items don't exist yet; "Get help" is
still unconditionally rendered (empty-activeKits guard not yet added).

- [ ] **Step 4: Write minimal implementation**

Replace `src/components/account-menu.tsx` in full:

```typescript
// src/components/account-menu.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FeedbackForm } from "@/components/feedback-form";
import { SupportForm } from "@/components/support-form";
import { signOutAction } from "@/app/actions/auth";

/** Single-letter avatar fallback derived from an email's first character —
 *  Merqo has no stored display name (vendors and team members are identified
 *  by email/user_id only) to draw real initials from. */
export function initials(email: string | null | undefined): string {
  const first = email?.trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}

/** Shared account-menu trigger for /dashboard and /admin headers — an image
 *  avatar (or initials fallback) that opens a dropdown with the signed-in
 *  email, a Profile link, a Get Help submenu (listing the vendor's active
 *  kits' support links), Feedback and Report a problem (each opening a
 *  Sheet form for hub-level input), an optional switch link for dual-role
 *  accounts, and Sign out. */
export function AccountMenu({
  email,
  avatarUrl,
  activeKits = [],
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  activeKits?: { slug: string; name: string; href: string }[];
  switchTo?: { href: string; label: string };
}) {
  const [, startTransition] = useTransition();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {avatarUrl ? (
              // size-8 avatar; next/image's optimization overhead isn't worth
              // it here, and Merqo has no next.config.ts remote-pattern setup
              // for external avatar hosts (Google) today.
              // eslint-disable-next-line @next/next/no-img-element -- fixed
              <img
                src={avatarUrl}
                alt="Profile picture"
                className="size-8 shrink-0 rounded-md object-cover ring-1 ring-primary/25 ring-inset"
              />
            ) : (
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25 ring-inset"
              >
                {initials(email)}
              </span>
            )}
            {email && (
              <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
                {email}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
            {email ?? "Account"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
          {activeKits.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                Get help
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {activeKits.map((k) => (
                  <DropdownMenuItem
                    key={k.slug}
                    asChild
                    className="cursor-pointer"
                  >
                    <a
                      href={`${k.href}/dashboard`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {k.name} support
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setFeedbackOpen(true)}
          >
            Feedback
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setSupportOpen(true)}
          >
            Report a problem
          </DropdownMenuItem>
          {switchTo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={switchTo.href}>{switchTo.label}</Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onSelect={() => startTransition(() => signOutAction())}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">
              Feedback
            </SheetTitle>
            <SheetDescription>
              How&apos;s Merqo working for you? Tell us what&apos;s working,
              what&apos;s missing, or what&apos;s broken.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FeedbackForm />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">
              Report a problem
            </SheetTitle>
            <SheetDescription>
              Something not working, or need help with your Merqo account?
              Tell us and we&apos;ll follow up.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <SupportForm />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run test/components/account-menu.test.tsx`
Expected: PASS (all existing tests + the 3 new ones, "Contact Merqo" test
replaced)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/account-menu.tsx test/components/account-menu.test.tsx
git commit -m "feat: replace Contact Merqo mailto with Feedback and Support sheets"
```

---

### Task 9: `resolveSupportMessageAction` + `ResolveSupportMessageButton`

**Files:**

- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/resolve-support-message-button.tsx`
- Test: `test/lib/resolve-support-message-action.test.ts`
- Test: `test/components/resolve-support-message-button.test.tsx`

**Interfaces:**

- Consumes: `requireMerqoTeam` (`src/lib/team.ts`), `createServiceClient`
  (`src/lib/supabase/server.ts`), `ActionResult`.
- Produces: `resolveSupportMessageAction(id: string): Promise<ActionResult>`
  and `ResolveSupportMessageButton({ id }: { id: string })` — consumed by
  Task 10 (`/admin` Overview page).

- [ ] **Step 1: Write the failing tests**

```typescript
// test/lib/resolve-support-message-action.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

const { requireMerqoTeamMock, eqMock, updateMock, fromMock } = vi.hoisted(
  () => {
    const eqMock = vi.fn();
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const requireMerqoTeamMock = vi.fn();
    return { requireMerqoTeamMock, eqMock, updateMock, fromMock };
  },
);

vi.mock("@/lib/team", () => ({ requireMerqoTeam: requireMerqoTeamMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from: fromMock }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { resolveSupportMessageAction } from "@/app/admin/actions";

afterEach(() => vi.clearAllMocks());

describe("resolveSupportMessageAction", () => {
  it("requires team membership before touching the database", async () => {
    requireMerqoTeamMock.mockRejectedValue(new Error("not team"));
    await expect(resolveSupportMessageAction("m1")).rejects.toThrow();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updates the message status to resolved on success", async () => {
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
    eqMock.mockResolvedValue({ error: null });
    const res = await resolveSupportMessageAction("m1");
    expect(fromMock).toHaveBeenCalledWith("support_messages");
    expect(updateMock).toHaveBeenCalledWith({ status: "resolved" });
    expect(eqMock).toHaveBeenCalledWith("id", "m1");
    expect(res).toEqual({ success: true });
  });

  it("returns a friendly error when the update fails", async () => {
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
    eqMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await resolveSupportMessageAction("m1");
    expect(res).toEqual({ success: false, error: "Could not resolve" });
  });
});
```

```typescript
// test/components/resolve-support-message-button.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/admin/actions", () => ({
  resolveSupportMessageAction: vi.fn(),
}));

import { resolveSupportMessageAction } from "@/app/admin/actions";
import { ResolveSupportMessageButton } from "@/app/admin/resolve-support-message-button";

describe("ResolveSupportMessageButton", () => {
  it("calls the action with the message id when clicked", async () => {
    vi.mocked(resolveSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<ResolveSupportMessageButton id="m1" />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(resolveSupportMessageAction).toHaveBeenCalledWith("m1"),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/lib/resolve-support-message-action.test.ts test/components/resolve-support-message-button.test.tsx`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/admin/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

/** Mark a hub-level support message resolved. Team-gated; writes via the
 *  service client since resolving isn't the submitter's own action. */
export async function resolveSupportMessageAction(
  id: string,
): Promise<ActionResult> {
  await requireMerqoTeam();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("support_messages")
    .update({ status: "resolved" })
    .eq("id", id);
  if (error) {
    console.error("resolveSupportMessageAction failed", error.message);
    return { success: false, error: "Could not resolve" };
  }
  revalidatePath("/admin");
  return { success: true };
}
```

```typescript
// src/app/admin/resolve-support-message-button.tsx
"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveSupportMessageAction } from "./actions";

/** Mark a hub-level support message resolved once it's been handled. */
export function ResolveSupportMessageButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await resolveSupportMessageAction(id);
      if (!res.success) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? "Resolving…" : "Resolve"}
    </Button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/lib/resolve-support-message-action.test.ts test/components/resolve-support-message-button.test.tsx`
Expected: PASS (3 + 1 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/resolve-support-message-button.tsx test/lib/resolve-support-message-action.test.ts test/components/resolve-support-message-button.test.tsx
git commit -m "feat: add resolveSupportMessageAction and its Resolve button"
```

---

### Task 10: `listOpenSupportMessages` + wire into `/admin` Overview

**Files:**

- Create: `src/lib/support.ts`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**

- Consumes: `SUPPORT_CATEGORY_LABELS`, `SupportMessageInput` (Task 2),
  `ResolveSupportMessageButton` (Task 9).
- Produces: `listOpenSupportMessages(): Promise<{ id: string; email: string | null; category: SupportMessageInput["category"]; body: string; created_at: string }[]>`
  — not consumed by any later task in this plan.

No colocated test for either file: `listOpenSupportMessages` is a thin
service-role read (mirrors `listVendorGrants` in `src/lib/admin.ts`, which
also has no test — only the pure functions it calls, like
`groupVendorGrants`, are tested), and `src/app/admin/page.tsx` is a Server
Component page (this codebase's established convention is not to
unit-test those directly — confirmed during the previous feature's
planning). Verification is `pnpm build` succeeding plus a manual check.

- [ ] **Step 1: Write `listOpenSupportMessages`**

```typescript
// src/lib/support.ts
import { createServiceClient } from "@/lib/supabase/server";
import type { SupportMessageInput } from "@/lib/feedback-support-schemas";

export type OpenSupportMessage = {
  id: string;
  email: string | null;
  category: SupportMessageInput["category"];
  body: string;
  created_at: string;
};

/** Open support messages, oldest first, with the submitter's email resolved
 *  via the admin API (support_messages has no email column — same pattern
 *  as admin.ts's listTeamMembers). Gate callers with requireMerqoTeam(). */
export async function listOpenSupportMessages(): Promise<OpenSupportMessage[]> {
  const supabase = await createServiceClient();
  const [messagesRes, usersRes] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, user_id, category, body, created_at")
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
    category: m.category as SupportMessageInput["category"],
    body: m.body as string,
    created_at: m.created_at as string,
  }));
}
```

- [ ] **Step 2: Wire it into the Overview page**

Replace `src/app/admin/page.tsx` in full:

```typescript
// src/app/admin/page.tsx
import Link from "next/link";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { listVendorGrants } from "@/lib/admin";
import { listOpenSupportMessages } from "@/lib/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/feedback-support-schemas";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { classifyHealth } from "@/lib/health";
import { onboardingFunnel } from "@/lib/funnel";
import { money, computeTrend } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingFunnelView } from "./onboarding-funnel";
import { ProductTile } from "./product-tile";
import { StatusBanner } from "./status-banner";
import { ResolveSupportMessageButton } from "./resolve-support-message-button";

export const revalidate = 0;

export default async function AdminOverviewPage() {
  await requireMerqoTeam();
  const [products, grants, openSupport] = await Promise.all([
    listLiveProducts(),
    listVendorGrants(),
    listOpenSupportMessages(),
  ]);
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );
  const totals = summarizeOverview(results);

  // Reading the wall clock in an async server component is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const health = results.map((r) => classifyHealth(r, now));
  const lagging = health.filter((h) => h === "lagging").length;

  const links = grants.flatMap((g) => g.kits);
  const funnel = onboardingFunnel(links, totals.active_vendors);
  const waitlist = grants
    .flatMap((g) => g.kits.map((k) => ({ email: g.email, kit: k })))
    .filter((x) => x.kit.status === "waitlist");
  const attention =
    waitlist.length + totals.pending_upgrade_requests + openSupport.length;

  const allDown = products.length > 0 && totals.products_reporting === 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Overview
        </h1>
      </div>

      <StatusBanner
        reporting={totals.products_reporting}
        lagging={lagging}
        down={totals.products_down}
      />

      {attention > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs attention · {attention}
          </h2>
          {waitlist.map((w) => (
            <div
              key={`${w.email}-${w.kit.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${encodeURIComponent(w.email)}`}
                  className="truncate font-medium hover:underline"
                >
                  {w.email}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  waitlisted for {w.kit.slug}
                </p>
              </div>
            </div>
          ))}
          {openSupport.map((m) => (
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
          ))}
          {totals.pending_upgrade_requests > 0 && (
            <p className="text-sm text-muted-foreground">
              {totals.pending_upgrade_requests} upgrade request
              {totals.pending_upgrade_requests === 1 ? "" : "s"} across kits.
            </p>
          )}
        </section>
      )}

      {allDown ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground"
        >
          Metrics unavailable — no product is reporting right now.
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Revenue (all)"
            value={money(totals.revenue_cents_all)}
            accent
            icon={DollarSign}
          />
          <StatCard
            label="GMV (30d)"
            value={money(totals.gmv_cents_30d)}
            icon={TrendingUp}
          />
          <StatCard
            label="Active vendors"
            value={String(totals.active_vendors)}
            icon={Users}
          />
          <StatCard
            label="Orders (7d)"
            value={String(totals.orders_7d)}
            icon={ShoppingCart}
            trend={computeTrend(totals.orders_7d, totals.orders_prev_7d)}
          />
        </section>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <OnboardingFunnelView counts={funnel} />
      </div>

      <h2 className="mt-10 font-display text-lg font-bold tracking-tight">
        Products
      </h2>
      {products.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm font-medium">No products registered yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kits appear here once they&apos;re added to the registry.
          </p>
        </div>
      ) : (
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p, i) => (
            <ProductTile
              key={p.slug}
              name={p.name}
              result={results[i]}
              now={now}
            />
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify with a full build**

Run: `pnpm build`
Expected: succeeds. Then run `pnpm dev` and visually confirm on `/admin`
(signed in as a team member with at least one open support message in the
dev DB, if available): the "Needs attention" section shows a row for each
open support message with its category label + body preview and a Resolve
button.

- [ ] **Step 4: Commit**

```bash
git add src/lib/support.ts src/app/admin/page.tsx
git commit -m "feat: surface open support messages in the admin Needs attention section"
```

---

### Task 11: `/admin/feedback` NPS page + `AdminNav` tab

**Files:**

- Create: `src/app/admin/feedback/page.tsx`
- Modify: `src/app/admin/admin-nav.tsx`

**Interfaces:**

- Consumes: `npsBreakdown` (Task 3), `requireMerqoTeam` (`src/lib/team.ts`).
- Produces: nothing consumed by a later task.

No colocated test for either file — same reasoning as Task 10 (Server
Component page; `AdminNav`'s `TABS` array is static config with no branching
logic to test, matching how its 4 existing entries are untested today).
Verification is `pnpm build` succeeding plus a manual check.

- [ ] **Step 1: Add the new tab**

In `src/app/admin/admin-nav.tsx`, add one entry to the existing `TABS`
array:

```typescript
const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/feedback", label: "Feedback" },
];
```

(Everything else in the file is unchanged — the `AdminNav` component body
already maps over `TABS` generically.)

- [ ] **Step 2: Write the Feedback page**

```typescript
// src/app/admin/feedback/page.tsx
import { requireMerqoTeam } from "@/lib/team";
import { createServerClient } from "@/lib/supabase/server";
import { npsBreakdown } from "@/lib/nps";

export const revalidate = 0;

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default async function AdminFeedbackPage() {
  await requireMerqoTeam();
  const supabase = await createServerClient();
  const { data: rows } = await supabase
    .from("feedback")
    .select("id, nps, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const all = rows ?? [];
  const nps = npsBreakdown(all.map((f) => f.nps as number));
  const comments = all.filter((f) => (f.message as string | null)?.trim());

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

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Vendor NPS · how vendors rate Merqo
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
    </main>
  );
}
```

- [ ] **Step 3: Verify with a full build**

Run: `pnpm build`
Expected: succeeds, `/admin/feedback` listed as a route. Then run
`pnpm dev` and visually confirm: the new "Feedback" tab appears in
`AdminNav`, and `/admin/feedback` renders the NPS card (and "No feedback
yet." if the dev DB has no rows).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/feedback/page.tsx src/app/admin/admin-nav.tsx
git commit -m "feat: add /admin/feedback NPS page and its AdminNav tab"
```

---

### Task 12: Full verification pass

- [ ] **Step 1: Run the full check**

Run: `pnpm check`
Expected: clean (prettier, eslint, `tsc --noEmit`).

- [ ] **Step 2: Run the full build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass, including every test added in Tasks 1–9.

- [ ] **Step 4: Commit if anything was left unstaged**

```bash
git status --short
```

If clean, nothing to do — each task already committed its own changes.

---

## Self-Review Notes

- **Spec coverage:** migration with qkit-mirrored RLS (Task 1); Zod schemas
  - category labels (Task 2); `npsBreakdown` ported (Task 3);
    `submitSupportMessageAction`/`SupportForm` (Tasks 4–5);
    `submitFeedbackAction`/`FeedbackForm` (Tasks 6–7); `Sheet` primitive +
    `AccountMenu` wiring, Contact Merqo removed (Task 8);
    `resolveSupportMessageAction`/button (Task 9); open support messages in
    the Overview's Needs attention section (Task 10); `/admin/feedback` page
  - `AdminNav` tab (Task 11). Every spec requirement maps to a task.
- **No placeholders** — every step has complete, runnable code, including
  the full replacement content for both modified pages
  (`src/app/admin/page.tsx`, `src/components/account-menu.tsx`).
- **Type consistency** — `SupportMessageInput["category"]` (Task 2) is the
  single source of type truth for `SUPPORT_CATEGORY_LABELS` (Task 2),
  `SupportForm`'s `CATEGORIES` (Task 5), and `OpenSupportMessage.category`
  (Task 10) — no category list is duplicated as a separate literal union
  anywhere. `ActionResult` is used identically by all three new Server
  Actions (Tasks 4, 6, 9).
- **Mock-hoisting convention applied consistently** — Tasks 4, 6, and 9's
  tests all use the `vi.hoisted()` pattern (all mock state created inside
  the hoisted factory itself, not referenced from an outer `const`) that
  this session's earlier plan discovered was necessary for `vi.mock()`
  factories referencing `vi.fn()` variables — applied proactively here
  rather than left for a task reviewer to catch a second time.
- **Regression caught during self-review:** an earlier draft of Task 8
  unconditionally rendered the "Get help" submenu, which — once "Contact
  Merqo" no longer guarantees at least one item inside it — would leave a
  vendor with zero active kits able to open a completely empty submenu
  panel. Fixed by gating the whole `DropdownMenuSub` on
  `activeKits.length > 0`, with a new test (`"hides the Get help submenu
when there are no active kits..."`) added to Task 8 to cover it.
