# Merqo Dashboard Kit Discovery Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard` clearly separates a vendor's active kits from what they can add now and what's coming, with richer per-kit copy, hover polish, and small illustrated previews for the two nearest-term kits — and `/dashboard/pending` gives a zero-kit vendor one real, actionable card instead of a dead end.

**Architecture:** `Kit` (`src/lib/kits.ts`) gains `description`/`features` fields. Two new pure functions in `src/lib/vendor.ts` (`comingKits`, and a widened `addableKits` that now returns full `Kit`s instead of a narrow `KitTile` projection) drive three discovery buckets — Ready to add / Coming soon / Planned — mirroring the exact three-way grouping and labels the landing page's `ModuleList` already uses, for consistency. A single reusable `KitDiscoveryCard` (`src/components/dashboard/`) renders all three buckets, taking an optional `preview` slot (filled only for qkit/loopkit) and an optional `cta` slot (Add link / Join-waitlist button / nothing). A signed-in, no-email-field waitlist action (`joinWaitlistAction`) replaces the public `WaitlistForm`'s email-capture flow for the already-authenticated dashboard context.

**Tech Stack:** Next.js 16 Server/Client Components, Zod, Vitest + Testing Library, sonner (`toast`, already mounted), Tailwind v4 (`group`/`group-hover` utilities — no plugin needed).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Validate all user input with Zod `safeParse()` at every boundary (AGENTS.md).
- No custom preview component for the 4 `planned` kits — icon/description only.
- No real waitlist/DB write for `planned` kits — they have no `merqo.products` row today (CHECK constraint only allows `live`/`coming_soon`) and none is added by this plan.
- No new route — everything stays on the existing `/dashboard` and `/dashboard/pending` pages.
- No full explore-grid duplication onto `/dashboard/pending` — one featured card plus a link out, not the whole "Explore more kits" section.
- Card hover transitions stay under 300ms; the base (non-hover) card must stay fully legible and all interactive content must exist in the DOM (not hover-conditional) for touch/keyboard users and accessibility.
- Run `pnpm build`, not just `pnpm check`, before calling any task done (this session's CI failure was a build-only failure mode `pnpm check` does not catch).

---

### Task 1: `Kit` data model — `description` and `features`

**Files:**

- Modify: `src/lib/kits.ts`
- Modify: `test/lib/kits.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `Kit.description: string` and `Kit.features: string[]` — consumed by `KitDiscoveryCard` (Task 4) and every discovery bucket (Task 3, Task 6).

- [ ] **Step 1: Write the failing test**

Add to `test/lib/kits.test.ts`, inside the existing `describe("kit family config", ...)` block:

```typescript
it("every kit has a fuller description and at least 3 feature bullets", () => {
  for (const k of KITS) {
    expect(k.description.length).toBeGreaterThan(30);
    expect(k.features.length).toBeGreaterThanOrEqual(3);
    for (const f of k.features) expect(f.length).toBeGreaterThan(5);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/kits.test.ts`
Expected: FAIL — `k.description` is `undefined`, `.length` throws or the
`toBeGreaterThan` assertion fails.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/kits.ts`, add the two fields to the `Kit` type and populate every
entry in `KITS`:

```typescript
export type Kit = {
  slug: string;
  name: string;
  /** One-line, plain-language "what it does" for a non-technical vendor. */
  tagline: string;
  /** 2-3 sentence explanation for the dashboard's discovery cards. */
  description: string;
  /** 3-4 short "what you get" bullets for the dashboard's discovery cards. */
  features: string[];
  status: KitStatus;
  /** Only set for `live` kits — where the CTA sends the vendor. */
  href?: string;
};
```

```typescript
export const KITS: Kit[] = [
  {
    slug: "qkit",
    name: "qkit",
    tagline:
      "Take orders and run your queue from a QR code — no app, no hardware.",
    description:
      "Customers scan a QR code to join your queue or place an order — no app download, no extra hardware. You get a live dashboard to manage orders, track busy periods, and keep the line moving.",
    features: [
      "QR-code ordering and queueing",
      "Live order dashboard",
      "Works on any phone, no app needed",
      "Free and Pro tiers",
    ],
    status: "live",
    href: QKIT_URL,
  },
  {
    slug: "loopkit",
    name: "loopkit",
    tagline: "Stamp cards, points and tiers that bring customers back.",
    description:
      "Digital stamp cards and a points system that turns one-time buyers into regulars. Customers collect stamps or points on every visit and redeem rewards you set — all tracked automatically, no punch cards to lose.",
    features: [
      "Digital stamp cards & points",
      "Custom rewards and tiers",
      "Automatic visit tracking",
      "Works alongside your other kits",
    ],
    status: "coming",
  },
  {
    slug: "shopkit",
    name: "shopkit",
    tagline: "A simple storefront for your catalog, checkout and pre-orders.",
    description:
      "A lightweight online storefront for your products — list your catalog, take orders and pre-orders, and get paid, all from one link you can share anywhere.",
    features: [
      "Shareable online storefront",
      "Catalog & pre-orders",
      "Built-in checkout",
      "No fee on your own PayNow",
    ],
    status: "planned",
  },
  {
    slug: "paykit",
    name: "paykit",
    tagline: "Collect PayNow, cards and cash — with receipts and e-invoices.",
    description:
      "One place to collect payment however your customer prefers — PayNow, cards or cash — with automatic receipts and e-invoices, so your books stay tidy without extra admin.",
    features: [
      "PayNow, card & cash in one flow",
      "Automatic receipts",
      "E-invoices",
      "Syncs with your other kits' orders",
    ],
    status: "planned",
  },
  {
    slug: "stockkit",
    name: "stockkit",
    tagline: "Track stock in and out, and know what each dish really costs.",
    description:
      "Keep a real-time count of what's on your shelves or in your kitchen, and see the true cost of every dish or product — so you know what's actually making you money.",
    features: [
      "Real-time stock tracking",
      "Ingredient/product cost breakdown",
      "Low-stock alerts",
      "Ties stock movement to your sales",
    ],
    status: "planned",
  },
  {
    slug: "reachkit",
    name: "reachkit",
    tagline:
      "Reach customers by SMS, email and WhatsApp — and collect reviews.",
    description:
      "Send updates, promotions and reminders to your customers over SMS, email or WhatsApp, and collect reviews after every visit — all from the same customer list your other kits already know.",
    features: [
      "SMS, email & WhatsApp campaigns",
      "Automated review requests",
      "Shared customer list across kits",
      "Simple campaign templates",
    ],
    status: "planned",
  },
];
```

(Only the new fields are shown as additions — every other line of each entry,
including `QKIT_URL`, `WAITLISTABLE_SLUGS`, `LIVE_KITS`, `COMING_KITS`, is
unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/kits.test.ts`
Expected: PASS (all existing + 1 new test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/kits.ts test/lib/kits.test.ts
git commit -m "feat: add description and feature bullets to each kit"
```

---

### Task 2: Illustrated preview components — qkit and loopkit

**Files:**

- Create: `src/components/dashboard/kit-previews/mockup-window.tsx`
- Create: `src/components/dashboard/kit-previews/qkit-preview.tsx`
- Create: `src/components/dashboard/kit-previews/loopkit-preview.tsx`
- Create: `src/components/dashboard/kit-previews/index.ts`
- Test: `test/components/kit-previews.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `KIT_PREVIEWS: Record<string, React.ComponentType>` — consumed by
  `KitDiscoveryCard` (Task 4), keyed by `Kit.slug`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/components/kit-previews.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KIT_PREVIEWS } from "@/components/dashboard/kit-previews";

describe("KIT_PREVIEWS", () => {
  it("has a preview for qkit and loopkit only", () => {
    expect(Object.keys(KIT_PREVIEWS).sort()).toEqual(["loopkit", "qkit"]);
  });

  it("renders the qkit preview without throwing", () => {
    const Preview = KIT_PREVIEWS.qkit;
    const { container } = render(<Preview />);
    expect(container.textContent).toContain("Now serving");
  });

  it("renders the loopkit preview without throwing", () => {
    const Preview = KIT_PREVIEWS.loopkit;
    const { container } = render(<Preview />);
    // 8 stamp circles, 3 filled — assert the filled count specifically, since
    // that's the one detail that makes this read as a real stamp card.
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(
      3,
    );
    expect(container.querySelectorAll('[data-filled="false"]')).toHaveLength(
      5,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/kit-previews.test.tsx`
Expected: FAIL — `Cannot find module '@/components/dashboard/kit-previews'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/dashboard/kit-previews/mockup-window.tsx

/** Small chrome-frame wrapper (browser-bar dots) around a handful of real
 *  domain objects — NOT a fake screenshot. Research into how premium
 *  products (Linear, Stripe, Vercel) illustrate their own UI found that
 *  faking a full "screen" reads as cheap; this frame + a real object inside
 *  it (a stamp row, a ticket number) is the concrete, well-precedented
 *  alternative. Shadow-as-border edge instead of a flat `border`, one accent
 *  color max inside, static — no idle animation. */
export function MockupWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
        <span aria-hidden className="size-2 rounded-full bg-muted-foreground/25" />
        <span aria-hidden className="size-2 rounded-full bg-muted-foreground/25" />
        <span aria-hidden className="size-2 rounded-full bg-muted-foreground/25" />
      </div>
      <div className="flex items-center justify-center bg-card px-6 py-8">
        {children}
      </div>
    </div>
  );
}
```

```typescript
// src/components/dashboard/kit-previews/qkit-preview.tsx
import { MockupWindow } from "./mockup-window";

export function QkitPreview() {
  return (
    <MockupWindow>
      <div className="text-center">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Now serving
        </p>
        <p className="font-display text-3xl font-bold text-primary">42</p>
      </div>
    </MockupWindow>
  );
}
```

```typescript
// src/components/dashboard/kit-previews/loopkit-preview.tsx
import { cn } from "@/lib/utils";
import { MockupWindow } from "./mockup-window";

const STAMPS_FILLED = 3;
const STAMPS_TOTAL = 8;

export function LoopkitPreview() {
  return (
    <MockupWindow>
      <div className="flex gap-1.5">
        {Array.from({ length: STAMPS_TOTAL }, (_, i) => {
          const filled = i < STAMPS_FILLED;
          return (
            <span
              key={i}
              data-filled={filled}
              className={cn(
                "size-4 rounded-full border-2",
                filled
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/25",
              )}
            />
          );
        })}
      </div>
    </MockupWindow>
  );
}
```

```typescript
// src/components/dashboard/kit-previews/index.ts
import type { ComponentType } from "react";
import { QkitPreview } from "./qkit-preview";
import { LoopkitPreview } from "./loopkit-preview";

export const KIT_PREVIEWS: Record<string, ComponentType> = {
  qkit: QkitPreview,
  loopkit: LoopkitPreview,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/kit-previews.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/kit-previews test/components/kit-previews.test.tsx
git commit -m "feat: add illustrated mini previews for qkit and loopkit"
```

---

### Task 3: `comingKits` + widen `addableKits` to return full `Kit`s

**Files:**

- Modify: `src/lib/vendor.ts`
- Modify: `test/lib/vendor.test.ts`

**Interfaces:**

- Consumes: `Kit`, `KITS` (already imported in `vendor.ts`).
- Produces: `addableKits(links, kits?): Kit[]` (return type widened — was
  `KitTile[]`) and `comingKits(links, kits?): Kit[]` — both consumed by the
  `/dashboard` page (Task 6) and `/dashboard/pending` (Task 8).

- [ ] **Step 1: Write the failing test**

Replace the existing `describe("addableKits", ...)` block in
`test/lib/vendor.test.ts` (the `kits` fixture already used there needs
`description`/`features` now that `Kit` requires them — Task 1 already added
those fields) and add a new `describe("comingKits", ...)` block right after
it:

```typescript
describe("addableKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      description: "Take orders and run your queue from a QR code.",
      features: ["QR ordering", "Live dashboard", "No app needed"],
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      description: "Digital stamp cards and points that bring customers back.",
      features: ["Stamp cards", "Points", "Rewards"],
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      description: "A lightweight online storefront for your catalog.",
      features: ["Storefront", "Checkout", "Pre-orders"],
      status: "planned" as const,
    },
  ];

  it("includes a live kit the vendor has no vendor_links row for", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).toEqual(["qkit"]);
    expect(out[0].href).toBe("https://qkit-sg.vercel.app");
    expect(out[0].description).toBeTruthy();
  });

  it("excludes a live kit that already has any vendor_links row", () => {
    expect(addableKits([{ product_slug: "qkit" }], kits)).toEqual([]);
  });

  it("never includes a non-live kit regardless of link state", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).not.toContain("loopkit");
    expect(out.map((t) => t.slug)).not.toContain("shopkit");
  });
});

describe("comingKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      description: "Take orders and run your queue from a QR code.",
      features: ["QR ordering", "Live dashboard", "No app needed"],
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      description: "Digital stamp cards and points that bring customers back.",
      features: ["Stamp cards", "Points", "Rewards"],
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      description: "A lightweight online storefront for your catalog.",
      features: ["Storefront", "Checkout", "Pre-orders"],
      status: "planned" as const,
    },
  ];

  it("includes a coming kit the vendor has no vendor_links row for", () => {
    const out = comingKits([], kits);
    expect(out.map((k) => k.slug)).toEqual(["loopkit"]);
  });

  it("excludes a coming kit the vendor already waitlisted for", () => {
    expect(comingKits([{ product_slug: "loopkit" }], kits)).toEqual([]);
  });

  it("never includes a live or planned kit", () => {
    const out = comingKits([], kits);
    expect(out.map((k) => k.slug)).not.toContain("qkit");
    expect(out.map((k) => k.slug)).not.toContain("shopkit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: FAIL — `addableKits`'s current output has no `.description` field
(FAILs the new assertion), and `comingKits is not a function`.

- [ ] **Step 3: Write minimal implementation**

Replace `addableKits` in `src/lib/vendor.ts` and add `comingKits` right after
it:

```typescript
/** Live kits the vendor has no vendor_links row for at all (not active, not
 *  waitlist) — the "you haven't joined this yet" set for the self-serve
 *  add-a-kit section. Returns full Kit records (not a narrower KitTile
 *  projection) so callers can render description/features. Pure — tested. */
export function addableKits(
  links: { product_slug: string }[],
  kits: Kit[] = KITS,
): Kit[] {
  const linked = new Set(links.map((l) => l.product_slug));
  return kits.filter((k) => k.status === "live" && !linked.has(k.slug));
}

/** Coming-soon kits the vendor hasn't already waitlisted for — the
 *  dashboard's "Coming soon" discovery bucket. A kit the vendor already has
 *  ANY link to (waitlist or, in principle, active) is excluded, since
 *  they're already tracked in the "Pending requests" section instead.
 *  Pure — tested. */
export function comingKits(
  links: { product_slug: string }[],
  kits: Kit[] = KITS,
): Kit[] {
  const linked = new Set(links.map((l) => l.product_slug));
  return kits.filter((k) => k.status === "coming" && !linked.has(k.slug));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/vendor.test.ts`
Expected: PASS (all existing + new `addableKits`/`comingKits` tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts
git commit -m "feat: add comingKits and widen addableKits to return full Kit records"
```

---

### Task 4: `KitDiscoveryCard` — shared discovery-bucket card

**Files:**

- Create: `src/components/dashboard/kit-discovery-card.tsx`
- Test: `test/components/kit-discovery-card.test.tsx`

**Interfaces:**

- Consumes: `Kit` (`src/lib/kits.ts`), `KIT_PREVIEWS` (Task 2).
- Produces: `KitDiscoveryCard({ kit, cta? }: { kit: Kit; cta?: React.ReactNode })`
  — consumed by `/dashboard` (Task 6) and `/dashboard/pending` (Task 8).

- [ ] **Step 1: Write the failing test**

```typescript
// test/components/kit-discovery-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KitDiscoveryCard } from "@/components/dashboard/kit-discovery-card";

const qkit = {
  slug: "qkit",
  name: "qkit",
  tagline: "Take orders and run your queue.",
  description: "Take orders and run your queue from a QR code.",
  features: ["QR ordering", "Live dashboard", "No app needed"],
  status: "live" as const,
  href: "https://qkit-sg.vercel.app",
};

const shopkit = {
  slug: "shopkit",
  name: "shopkit",
  tagline: "A simple storefront.",
  description: "A lightweight online storefront for your catalog.",
  features: ["Storefront", "Checkout", "Pre-orders"],
  status: "planned" as const,
};

describe("KitDiscoveryCard", () => {
  it("renders the kit name, description, and first feature", () => {
    render(<KitDiscoveryCard kit={qkit} />);
    expect(screen.getByText("qkit")).toBeInTheDocument();
    expect(
      screen.getByText("Take orders and run your queue from a QR code."),
    ).toBeInTheDocument();
    expect(screen.getByText("QR ordering")).toBeInTheDocument();
  });

  it("renders the illustrated preview for a kit that has one", () => {
    render(<KitDiscoveryCard kit={qkit} />);
    expect(screen.getByText("Now serving")).toBeInTheDocument();
  });

  it("renders no preview for a kit without one", () => {
    render(<KitDiscoveryCard kit={shopkit} />);
    expect(screen.queryByText("Now serving")).not.toBeInTheDocument();
  });

  it("renders the cta slot when provided", () => {
    render(<KitDiscoveryCard kit={qkit} cta={<button>Add qkit</button>} />);
    expect(screen.getByRole("button", { name: "Add qkit" })).toBeInTheDocument();
  });

  it("renders no cta when the slot is omitted", () => {
    render(<KitDiscoveryCard kit={shopkit} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/components/kit-discovery-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/dashboard/kit-discovery-card'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/dashboard/kit-discovery-card.tsx
import type { Kit } from "@/lib/kits";
import { KIT_PREVIEWS } from "./kit-previews";

/** One discovery-bucket card — used for all three of /dashboard's
 *  "Explore more kits" subsections (Ready to add / Coming soon / Planned)
 *  and the single featured card on /dashboard/pending. The `cta` slot is
 *  omitted entirely for planned kits (no real action exists for them yet).
 *  The feature-bullet line is always in the DOM (not conditionally
 *  rendered) — only its opacity is hover-gated, so it stays available to
 *  screen readers and to touch/keyboard users who never trigger :hover. */
export function KitDiscoveryCard({
  kit,
  cta,
}: {
  kit: Kit;
  cta?: React.ReactNode;
}) {
  const Preview = KIT_PREVIEWS[kit.slug];

  return (
    <div className="group rounded-xl border bg-card p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      {Preview && (
        <div className="mb-4">
          <Preview />
        </div>
      )}
      <h3 className="font-display text-lg font-bold">{kit.name}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{kit.description}</p>
      <p className="mt-2 text-xs text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {kit.features[0]}
      </p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/components/kit-discovery-card.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/kit-discovery-card.tsx test/components/kit-discovery-card.test.tsx
git commit -m "feat: add KitDiscoveryCard for the dashboard's kit-explore sections"
```

---

### Task 5: Signed-in "Join waitlist" action + button

**Files:**

- Modify: `src/lib/waitlist.ts`
- Create: `src/app/actions/join-waitlist.ts`
- Create: `src/components/dashboard/join-waitlist-button.tsx`
- Test: `test/lib/join-waitlist.test.ts`
- Test: `test/components/join-waitlist-button.test.tsx`

**Interfaces:**

- Consumes: `addToWaitlist` (`src/lib/waitlist.ts`, unchanged signature),
  `WAITLISTABLE_SLUGS` (`src/lib/kits.ts`), `ActionResult`
  (`src/lib/action-result.ts`).
- Produces: `joinWaitlistAction(slug: string): Promise<ActionResult>` and
  `JoinWaitlistButton({ slug, kitName }: { slug: string; kitName: string })`
  — consumed by `/dashboard` (Task 6).

- [ ] **Step 1: Write the failing tests**

```typescript
// test/lib/join-waitlist.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

const addToWaitlistMock = vi.fn();
vi.mock("@/lib/waitlist", () => ({ addToWaitlist: addToWaitlistMock }));

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { joinWaitlistAction } from "@/app/actions/join-waitlist";

afterEach(() => vi.clearAllMocks());

describe("joinWaitlistAction", () => {
  it("rejects a slug that isn't waitlistable", async () => {
    const res = await joinWaitlistAction("qkit");
    expect(res).toEqual({
      success: false,
      error: "This kit isn't open for waitlist yet.",
    });
    expect(addToWaitlistMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await joinWaitlistAction("loopkit");
    expect(res).toEqual({ success: false, error: "Sign in first." });
  });

  it("adds the signed-in user's email to the waitlist on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "vendor@example.com" } },
    });
    const res = await joinWaitlistAction("loopkit");
    expect(addToWaitlistMock).toHaveBeenCalledWith(
      "vendor@example.com",
      "loopkit",
    );
    expect(res).toEqual({ success: true });
  });

  it("returns a friendly error when the write throws", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "vendor@example.com" } },
    });
    addToWaitlistMock.mockRejectedValue(new Error("db down"));
    const res = await joinWaitlistAction("loopkit");
    expect(res).toEqual({
      success: false,
      error: "Couldn't join the waitlist. Try again.",
    });
  });
});
```

```typescript
// test/components/join-waitlist-button.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/join-waitlist", () => ({
  joinWaitlistAction: vi.fn(),
}));

import { joinWaitlistAction } from "@/app/actions/join-waitlist";
import { JoinWaitlistButton } from "@/components/dashboard/join-waitlist-button";

describe("JoinWaitlistButton", () => {
  it("calls the action with the kit's slug when clicked", async () => {
    vi.mocked(joinWaitlistAction).mockResolvedValue({ success: true });
    render(<JoinWaitlistButton slug="loopkit" kitName="loopkit" />);
    fireEvent.click(screen.getByRole("button", { name: "Join waitlist" }));
    await waitFor(() =>
      expect(joinWaitlistAction).toHaveBeenCalledWith("loopkit"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/lib/join-waitlist.test.ts test/components/join-waitlist-button.test.tsx`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Write minimal implementation**

First, update the now-inaccurate comment in `src/lib/waitlist.ts` (the
function body and signature are unchanged — only the doc comment, since it's
about to gain a second caller):

```typescript
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Add an email to a kit's waitlist. Called by both the public landing
 * waitlist form (unauthenticated — email typed into the form) and the
 * signed-in dashboard's "Join waitlist" button (email comes from the
 * session, see src/app/actions/join-waitlist.ts).
 */
export async function addToWaitlist(
  email: string,
  productSlug: string,
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("vendor_links").upsert(
    {
      email: email.toLowerCase(),
      product_slug: productSlug,
      status: "waitlist",
    },
    { onConflict: "email,product_slug", ignoreDuplicates: true },
  );
  if (error) throw new Error(`waitlist upsert: ${error.message}`);
}
```

```typescript
// src/app/actions/join-waitlist.ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { addToWaitlist } from "@/lib/waitlist";
import { WAITLISTABLE_SLUGS } from "@/lib/kits";
import type { ActionResult } from "@/lib/action-result";

/** Signed-in vendor joins a coming-soon kit's waitlist from /dashboard — no
 *  email field needed (unlike the public landing WaitlistForm), since the
 *  vendor is already authenticated. */
export async function joinWaitlistAction(slug: string): Promise<ActionResult> {
  if (!WAITLISTABLE_SLUGS.includes(slug)) {
    return { success: false, error: "This kit isn't open for waitlist yet." };
  }
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { success: false, error: "Sign in first." };
  try {
    await addToWaitlist(email, slug);
  } catch {
    return { success: false, error: "Couldn't join the waitlist. Try again." };
  }
  revalidatePath("/dashboard");
  return { success: true };
}
```

```typescript
// src/components/dashboard/join-waitlist-button.tsx
"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinWaitlistAction } from "@/app/actions/join-waitlist";
import { Button } from "@/components/ui/button";

export function JoinWaitlistButton({
  slug,
  kitName,
}: {
  slug: string;
  kitName: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await joinWaitlistAction(slug);
      if (res.success) {
        toast.success(`You're on the waitlist for ${kitName}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Joining…" : "Join waitlist"}
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/lib/join-waitlist.test.ts test/components/join-waitlist-button.test.tsx`
Expected: PASS (4 + 1 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/waitlist.ts src/app/actions/join-waitlist.ts src/components/dashboard/join-waitlist-button.tsx test/lib/join-waitlist.test.ts test/components/join-waitlist-button.test.tsx
git commit -m "feat: add a signed-in join-waitlist action for the dashboard"
```

---

### Task 6: Wire the new "Explore more kits" section into `/dashboard`

**Files:**

- Modify: `src/app/dashboard/(app)/page.tsx`

**Interfaces:**

- Consumes: `addableKits`/`comingKits` (Task 3), `KitDiscoveryCard` (Task 4),
  `JoinWaitlistButton` (Task 5), `KITS` (`src/lib/kits.ts`).
- Produces: nothing consumed by a later task — this is the page itself.

No colocated test for this page: grepping `test/` confirms no test in this
codebase directly imports or renders a `page.tsx` Server Component — the
same convention already established for API routes (`/api/merqo/metrics`,
`/api/merqo/vendor-status`), where only the _pure logic_ the route/page
assembles gets a unit test, and the route/page itself is a thin wrapper
verified by `pnpm build` plus manual/visual checking. Here, that pure logic
is already fully covered: `addableKits`/`comingKits` (Task 3),
`KitDiscoveryCard` (Task 4), `JoinWaitlistButton` (Task 5), and
`VendorKitCard` (Task 7) each have their own tests — this task only wires
them together.

- [ ] **Step 1: Write the implementation**

Replace `src/app/dashboard/(app)/page.tsx` in full:

```typescript
import Link from "next/link";
import {
  requireActiveVendor,
  tilesForLinks,
  addableKits,
  comingKits,
} from "@/lib/vendor";
import { KITS } from "@/lib/kits";
import { VendorKitCard } from "./vendor-kit-card";
import { KitDiscoveryCard } from "@/components/dashboard/kit-discovery-card";
import { JoinWaitlistButton } from "@/components/dashboard/join-waitlist-button";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);
  const readyToAdd = addableKits(links);
  const comingSoon = comingKits(links);
  const planned = KITS.filter((k) => k.status === "planned");

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard key={t.slug} tile={t} />
        ))}
      </section>

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Requested
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((t) => (
              <li
                key={t.slug}
                className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">
                  — we&apos;ll email you when it opens.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Explore more kits
        </h2>

        {readyToAdd.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ready to add
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {readyToAdd.map((kit) => (
                <KitDiscoveryCard
                  key={kit.slug}
                  kit={kit}
                  cta={
                    kit.href && (
                      <a
                        href={`${kit.href}/login`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        Add {kit.name}
                      </a>
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {comingSoon.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Coming soon
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {comingSoon.map((kit) => (
                <KitDiscoveryCard
                  key={kit.slug}
                  kit={kit}
                  cta={
                    <JoinWaitlistButton slug={kit.slug} kitName={kit.name} />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {planned.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Planned
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {planned.map((kit) => (
                <KitDiscoveryCard key={kit.slug} kit={kit} />
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        More kits coming —{" "}
        <Link
          href="/#kits"
          className="font-medium text-foreground hover:underline"
        >
          see the family
        </Link>
        .
      </p>
    </>
  );
}
```

Note the three subsection labels ("Ready to add", "Coming soon", "Planned")
deliberately mirror `src/components/landing/kit-stacker/module-list.tsx`'s
existing `GROUPS` labels ("Live now" is renamed "Ready to add" here since
context differs — this is "kits you can add", not "kits that are live" —
but "Coming soon" and "Planned" are copied verbatim for consistency with
copy the vendor may already have seen on the landing page).

- [ ] **Step 2: Verify with a full build**

Run: `pnpm build`
Expected: succeeds. Then run `pnpm dev` and visually confirm on
`/dashboard`: a vendor with an active kit sees "Your kits", and — since
`/dashboard` always shows every non-active bucket that has entries — "Coming
soon" (loopkit) and "Planned" (the other four) underneath "Explore more
kits".

- [ ] **Step 3: Commit**

```bash
git add "src/app/dashboard/(app)/page.tsx"
git commit -m "feat: split /dashboard into Your kits and a 3-bucket Explore section"
```

---

### Task 7: `VendorKitCard` hover treatment

**Files:**

- Modify: `src/app/dashboard/(app)/vendor-kit-card.tsx`
- Test: `test/app/vendor-kit-card.test.tsx`

**Interfaces:**

- Consumes: `KitTile` (`src/lib/vendor.ts`, unchanged).
- Produces: nothing consumed by a later task.

Scope note: unlike the new discovery cards (Task 4), an already-active kit
tile's primary actions (Open/Upgrade/Downgrade) are already always visible
and there's no natural "one extra line" to reveal — this task adds only the
lift/shadow/border-color hover shift, matching the base card styling used
throughout Merqo (`vendor-list.tsx`'s cards, `product-tile.tsx`), not a
content reveal.

- [ ] **Step 1: Write the failing test**

```typescript
// test/app/vendor-kit-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorKitCard } from "@/app/dashboard/(app)/vendor-kit-card";

describe("VendorKitCard", () => {
  it("applies the hover-lift treatment to the card root", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
      />,
    );
    const card = screen.getByText("qkit").closest("div");
    expect(card?.className).toContain("hover:-translate-y-0.5");
    expect(card?.className).toContain("hover:shadow-md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/app/vendor-kit-card.test.tsx`
Expected: FAIL — the current card has no `hover:` classes.

- [ ] **Step 3: Write minimal implementation**

In `src/app/dashboard/(app)/vendor-kit-card.tsx`, change only the root
`<div>`'s `className`:

```typescript
    <div className="rounded-xl border bg-card p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
```

(Everything else in the file is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/app/vendor-kit-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/(app)/vendor-kit-card.tsx test/app/vendor-kit-card.test.tsx
git commit -m "feat: add hover lift/shadow treatment to active kit tiles"
```

---

### Task 8: `/dashboard/pending` — one featured card instead of a dead end

**Files:**

- Modify: `src/app/dashboard/pending/page.tsx`

**Interfaces:**

- Consumes: `addableKits` (Task 3), `KitDiscoveryCard` (Task 4).
- Produces: nothing consumed by a later task.

No colocated test for this page, for the same reason as Task 6: confirmed
via `ls test/app | grep -i pending` that no test currently covers this page
(no precedent to extend), and this codebase's established convention is to
unit-test the pure logic a page assembles, not the page itself.
`addableKits` (Task 3) and `KitDiscoveryCard` (Task 4) already cover the
logic this task wires together.

- [ ] **Step 1: Write the implementation**

Replace `src/app/dashboard/pending/page.tsx` in full:

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  loadVendorContext,
  tilesForLinks,
  hasRenderableActiveKit,
  addableKits,
} from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";
import { KitDiscoveryCard } from "@/components/dashboard/kit-discovery-card";

export const revalidate = 0;

// Reachable only by a signed-in user who is not an active vendor. Not under the
// (app) gate, so requireActiveVendor's redirect here can't loop. Sends anyone who
// actually qualifies onward via /post-login.
export default async function PendingPage() {
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) redirect("/login");
  if (isTeam) redirect("/admin");

  // A vendor with zero links may have signed up directly on a kit — check
  // before showing "no kits yet" (see vendor-sync.ts; best-effort, never
  // throws, so a sync failure just leaves `links` as the empty array it
  // already was).
  const links =
    initialLinks.length === 0 && user.email
      ? await syncVendorKits(user.email)
      : initialLinks;

  if (hasRenderableActiveKit(links)) redirect("/dashboard");

  const { pending } = tilesForLinks(links);
  // Deliberately NOT the full "Explore more kits" grid from /dashboard — one
  // featured, actionable card plus a link out, per the empty-state research
  // (Nielsen Norman Group: give a direct pathway, not a full catalog dump
  // right after signup).
  const featured = addableKits(links)[0];

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border bg-card px-7 py-10 shadow-sm">
          <Wordmark className="text-2xl" />
          {pending.length > 0 ? (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                You&rsquo;re on the list
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We&rsquo;ll email{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>{" "}
                when {pending.length === 1 ? "it opens" : "these open"}:
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {pending.map((t) => (
                  <li key={t.slug} className="font-medium">
                    {t.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                No kits yet
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                You&rsquo;re signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
                , but no kits are active on this account yet.
              </p>
            </>
          )}

          {featured?.href && (
            <div className="mt-6 text-left">
              <KitDiscoveryCard
                kit={featured}
                cta={
                  <a
                    href={`${featured.href}/login`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    Add {featured.name}
                  </a>
                }
              />
            </div>
          )}

          <p className="mt-5 text-sm text-muted-foreground">
            More kits on the way —{" "}
            <Link
              href="/#kits"
              className="font-medium text-foreground hover:underline"
            >
              see the family
            </Link>
            .
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <Button asChild className="h-11 w-full rounded-xl">
              <Link href="/post-login">Check again</Link>
            </Button>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="h-11 w-full rounded-xl"
              >
                Sign out
              </Button>
            </form>
            <Button asChild variant="ghost" className="h-11 w-full rounded-xl">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify with a full build**

Run: `pnpm build`
Expected: succeeds. Then run `pnpm dev` and visually confirm both states on
`/dashboard/pending`: a vendor with zero links sees qkit as a featured
"Add qkit" card plus the "more kits on the way" line; a vendor who already
has any link to qkit sees no featured card (only the unchanged pending-list/
no-kits-yet copy).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/pending/page.tsx
git commit -m "feat: show one featured addable kit on the zero-kit pending page"
```

---

### Task 9: Full verification pass

- [ ] **Step 1: Run the full check**

Run: `pnpm check`
Expected: clean (prettier, eslint, `tsc --noEmit`).

- [ ] **Step 2: Run the full build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass, including every test added in Tasks 1–8.

- [ ] **Step 4: Commit if anything was left unstaged**

```bash
git status --short
```

If clean, nothing to do — each task already committed its own changes.

---

## Self-Review Notes

- **Spec coverage:** three-bucket Explore section (Ready to add / Coming
  soon / Planned) — Task 6; hover polish on both discovery cards (Task 4)
  and active tiles (Task 7); richer `description`/`features` copy — Task 1;
  illustrated previews for qkit + loopkit only — Task 2; lighter pending-page
  treatment (one featured card, not the full grid) — Task 8. Every spec
  requirement maps to a task.
- **No placeholders** — every step has complete, runnable code and complete
  per-kit copy (all 6 kits' `description`/`features` are real, finished
  sentences, not "TBD").
- **Testing-convention correction made during self-review:** an earlier draft
  of Tasks 6 and 8 proposed a colocated test that directly awaited/rendered
  each async Server Component page. Grepping `test/` confirmed no test
  anywhere in this codebase does that — pages and route handlers are both
  left untested directly, with only the pure logic and child components they
  assemble getting unit tests (e.g. `/api/merqo/metrics` has no route test,
  only `computeMerqoMetrics` does). The plan was corrected to follow that
  same convention: Tasks 6 and 8 have no colocated test, verified instead by
  `pnpm build` plus a manual check, while every piece of logic they assemble
  (Tasks 1–5, 7) is fully unit-tested.
- **Type consistency** — `KitDiscoveryCard`'s `kit: Kit` prop (Task 4)
  matches what `addableKits`/`comingKits` (Task 3) and `KITS.filter(...)`
  (Task 6) all produce — full `Kit` records throughout, no narrower
  projection anywhere in this plan. `JoinWaitlistButton`'s `slug`/`kitName`
  props (Task 5) match how Task 6 calls it (`kit.slug`/`kit.name`).
- **Deviation from the spec, called out explicitly:** the spec describes one
  "Coming soon" subsection covering both `coming` and `planned` kits,
  "visually distinguished by a badge/label." This plan instead splits them
  into two subsections — "Coming soon" (loopkit) and "Planned" (the other
  four) — mirroring the exact three-way grouping and labels
  `src/components/landing/kit-stacker/module-list.tsx` already uses on the
  landing page. Reasoning: matching existing, already-shipped copy/structure
  the vendor may have already seen beats inventing a new badge-based
  distinction for the same information. The outcome is identical to the
  spec's intent (an already-real, actionable item reads differently from an
  informational-only one) — just implemented via section labels instead of
  a badge.
- **Existing-function widening:** `addableKits`'s return type changes from
  `KitTile[]` to `Kit[]` (Task 3). Checked every call site: only
  `src/app/dashboard/(app)/page.tsx` (rewritten in Task 6) and its own test
  file (updated in Task 3) use it — no other consumer exists in the
  codebase, so this is a safe, contained widening, not a breaking change.
