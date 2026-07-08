# Merqo Vendor Portal Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a granted vendor log in, get role-routed to a vendor-facing `/dashboard`, and see their active kit tiles (each linking out to the kit's own app), with a waitlist-aware pending page for users who have no active kit yet.

**Architecture:** Add a `/dashboard/*` vendor namespace beside the existing `/admin/*` team console. A shared home-resolver routes each signed-in user (team → `/admin`, active-vendor → `/dashboard`, else → `/dashboard/pending`). The gated dashboard shell lives in a `(app)` route group so the ungated pending page can sit under `/dashboard/pending` without tripping the gate's redirect. Vendors read only their own `vendor_links` via the RLS-scoped cookie client; tile display data comes from the static `kits.ts` config, so no `products` grant and no qkit change.

**Tech Stack:** Next 16 (App Router, async `cookies`/`params`, route handlers), TypeScript strict, Tailwind v4, shadcn/ui, Supabase (`@supabase/ssr`) with RLS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-08-merqo-vendor-portal-2a-design.md`
**Reference:** `src/lib/team.ts` (`requireMerqoTeam` pattern), `src/app/admin/layout.tsx` (gated shell), `../qkit/src/app/dashboard/layout.tsx` (vendor header), `src/app/no-access/page.tsx` (standalone page pattern).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Authorization lives in RLS + the service-role boundary. Vendors read their own data via the **cookie client** (RLS-scoped); never the service client on a vendor path.
- `metrics_secret` never reaches a browser — do NOT grant `authenticated` any access to `merqo.products`. Tile metadata comes from static `src/lib/kits.ts`.
- Next 16: `cookies()`, `params`, `searchParams` are async — `await` them. Route handlers return `NextResponse.redirect`; server components use `redirect()`.
- Comments explain WHY not what; no change-narration; no commented-out code.
- Schema changes get a new numbered migration in `supabase/migrations/` (`0003_...`).
- templateCentral: only `templatecentral:standards` (drift check); never `add`/`scaffold`/`migrate`.
- Branch `feat/vendor-portal-2a`. Commit after every task. Verify gate: `pnpm check` + `pnpm test` green.

---

### Task 1: Migration `0003` — vendor read access

Grant the authenticated role SELECT on `vendor_links` (RLS still scopes to own rows) and harden the own-select policy to match emails case-insensitively.

**Files:**

- Create: `supabase/migrations/0003_vendor_read.sql`
- Test: `test/db/vendor-read.test.ts`

**Interfaces:**

- Produces: after this migration a signed-in vendor's cookie client can `select` its own `merqo.vendor_links` rows.

- [ ] **Step 1: Write the failing test** — `test/db/vendor-read.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/0003_vendor_read.sql", import.meta.url),
  ),
  "utf8",
).toLowerCase();

describe("0003_vendor_read migration", () => {
  it("grants select on vendor_links to authenticated", () => {
    expect(sql).toMatch(
      /grant select on merqo\.vendor_links to[^;]*authenticated/,
    );
  });
  it("does NOT grant authenticated any access to products (secret column)", () => {
    expect(sql).not.toMatch(
      /grant[^;]*on merqo\.products to[^;]*authenticated/,
    );
  });
  it("hardens the own-select policy to compare lowercased emails", () => {
    expect(sql).toContain("vendor_links_own_select");
    expect(sql).toMatch(/lower\s*\(\s*email\s*\)/);
    expect(sql).toMatch(
      /lower\s*\(\s*\(select auth\.jwt\(\) ->> 'email'\)\s*\)/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- vendor-read`
Expected: FAIL — cannot read `0003_vendor_read.sql` (file does not exist).

- [ ] **Step 3: Create the migration** — `supabase/migrations/0003_vendor_read.sql`:

```sql
-- Phase 2a: let a signed-in vendor read their OWN vendor_links so /dashboard can
-- render their kit tiles. The vendor_links_own_select policy already scopes rows
-- to the caller's email; this grant is what actually lets the authenticated
-- (cookie) client SELECT. Safe: vendor_links has NO secret column — metrics_secret
-- lives on merqo.products, which is deliberately NOT granted to authenticated.
grant select on merqo.vendor_links to authenticated;

-- Harden the own-select policy: lower() both sides so a mixed-case JWT email still
-- matches the lowercased stored email (grantKit lowercases on write). Team branch
-- unchanged.
drop policy if exists vendor_links_own_select on merqo.vendor_links;
create policy vendor_links_own_select on merqo.vendor_links
  for select using (
    merqo.is_merqo_team((select auth.uid()))
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- vendor-read`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_vendor_read.sql test/db/vendor-read.test.ts
git commit -m "feat: migration 0003 — vendor self-read grant + case-insensitive RLS"
```

---

### Task 2: Pure routing + tile helpers (`resolveHome`, `tilesForLinks`)

Two pure functions the gate, the resolver route, and the dashboard page all consume.

**Files:**

- Create: `src/lib/vendor.ts`
- Test: `test/lib/vendor.test.ts`

**Interfaces:**

- Consumes: `KITS` from `@/lib/kits`; `GrantStatus` (type) from `@/lib/admin`.
- Produces:
  - `type HomeDestination = "/admin" | "/dashboard" | "/dashboard/pending"`
  - `type KitTile = { slug: string; name: string; tagline: string; href: string | null }`
  - `resolveHome(input: { isTeam: boolean; hasActiveKit: boolean }): HomeDestination`
  - `tilesForLinks(links: { product_slug: string; status: GrantStatus }[]): { active: KitTile[]; pending: KitTile[] }`

- [ ] **Step 1: Write the failing test** — `test/lib/vendor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveHome, tilesForLinks } from "@/lib/vendor";

describe("resolveHome", () => {
  it("routes a team member to /admin regardless of kits", () => {
    expect(resolveHome({ isTeam: true, hasActiveKit: false })).toBe("/admin");
    expect(resolveHome({ isTeam: true, hasActiveKit: true })).toBe("/admin");
  });
  it("routes an active vendor to /dashboard", () => {
    expect(resolveHome({ isTeam: false, hasActiveKit: true })).toBe(
      "/dashboard",
    );
  });
  it("routes a non-active user to the pending page", () => {
    expect(resolveHome({ isTeam: false, hasActiveKit: false })).toBe(
      "/dashboard/pending",
    );
  });
});

describe("tilesForLinks", () => {
  it("splits active vs waitlist and maps slug→KITS metadata", () => {
    const { active, pending } = tilesForLinks([
      { product_slug: "qkit", status: "active" },
      { product_slug: "loopkit", status: "waitlist" },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(active[0].name).toBe("qkit");
    expect(active[0].href).toBeTruthy();
    expect(pending.map((t) => t.slug)).toEqual(["loopkit"]);
  });
  it("drops unknown/removed slugs (config is the display allow-list)", () => {
    const { active, pending } = tilesForLinks([
      { product_slug: "ghostkit", status: "active" },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- vendor`
Expected: FAIL — cannot find module `@/lib/vendor`.

- [ ] **Step 3: Implement the pure section** — `src/lib/vendor.ts`:

```ts
import { KITS } from "@/lib/kits";
import type { GrantStatus } from "@/lib/admin";

export type HomeDestination = "/admin" | "/dashboard" | "/dashboard/pending";

export type KitTile = {
  slug: string;
  name: string;
  tagline: string;
  href: string | null;
};

/** Where a signed-in user belongs. Pure so it can be unit-tested; callers
 *  supply the two facts (team membership, whether any kit is active). */
export function resolveHome(input: {
  isTeam: boolean;
  hasActiveKit: boolean;
}): HomeDestination {
  if (input.isTeam) return "/admin";
  if (input.hasActiveKit) return "/dashboard";
  return "/dashboard/pending";
}

/** Map a vendor's link rows onto display tiles via the static KITS config.
 *  KITS is the display allow-list — an unknown slug is dropped, not rendered. */
export function tilesForLinks(
  links: { product_slug: string; status: GrantStatus }[],
): { active: KitTile[]; pending: KitTile[] } {
  const bySlug = new Map(KITS.map((k) => [k.slug, k]));
  const active: KitTile[] = [];
  const pending: KitTile[] = [];
  for (const l of links) {
    const kit = bySlug.get(l.product_slug);
    if (!kit) continue;
    const tile: KitTile = {
      slug: kit.slug,
      name: kit.name,
      tagline: kit.tagline,
      href: kit.href ?? null,
    };
    (l.status === "active" ? active : pending).push(tile);
  }
  return { active, pending };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- vendor`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendor.ts test/lib/vendor.test.ts
git commit -m "feat: resolveHome + tilesForLinks vendor routing/tile helpers"
```

---

### Task 3: Vendor context loader + `requireActiveVendor` gate

The async layer that reads team membership + the vendor's own links, and the page gate built on it.

**Files:**

- Modify: `src/lib/vendor.ts` (append; keep the pure exports from Task 2)

**Interfaces:**

- Consumes: `resolveHome` (Task 2); `createServerClient` from `@/lib/supabase/server`; `redirect` from `next/navigation`; `User` from `@supabase/supabase-js`.
- Produces:
  - `type VendorLink = { product_slug: string; status: GrantStatus }`
  - `loadVendorContext(): Promise<{ user: User | null; isTeam: boolean; links: VendorLink[] }>` — non-redirecting; reads via the cookie client.
  - `requireActiveVendor(): Promise<{ user: User; links: VendorLink[] }>` — page gate: no session → `/login`; team → `/admin`; no active kit → `/dashboard/pending`; config fault → throw.

- [ ] **Step 1: Append the async layer** to `src/lib/vendor.ts` (after the pure functions):

```ts
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export type VendorLink = { product_slug: string; status: GrantStatus };

/** Read the signed-in user, team membership, and their own vendor_links (RLS
 *  scopes the rows to their email). Non-redirecting — callers decide routing. */
export async function loadVendorContext(): Promise<{
  user: User | null;
  isTeam: boolean;
  links: VendorLink[];
}> {
  const supabase = await createServerClient();
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return { user: null, isTeam: false, links: [] };
  }
  if (!user) return { user: null, isTeam: false, links: [] };

  const [teamRes, linksRes] = await Promise.all([
    supabase
      .from("merqo_team")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("vendor_links").select("product_slug, status"),
  ]);
  // A read error here is a config/grant fault (e.g. PGRST106 or a missing grant),
  // NOT "no kits" — surface it loudly rather than silently emptying the dashboard.
  if (teamRes.error)
    throw new Error(`merqo_team read failed: ${teamRes.error.message}`);
  if (linksRes.error)
    throw new Error(`vendor_links read failed: ${linksRes.error.message}`);

  return {
    user,
    isTeam: !!teamRes.data,
    links: (linksRes.data ?? []) as VendorLink[],
  };
}

/** Gate a /dashboard page on active-vendor access. Mirrors requireMerqoTeam. */
export async function requireActiveVendor(): Promise<{
  user: User;
  links: VendorLink[];
}> {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  const hasActiveKit = links.some((l) => l.status === "active");
  const dest = resolveHome({ isTeam, hasActiveKit });
  if (dest !== "/dashboard") redirect(dest);
  return { user, links };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT 0. (No new unit test — the pure `resolveHome`/`tilesForLinks` are already covered; `loadVendorContext`/`requireActiveVendor` are thin DB+redirect wrappers verified by typecheck here and the e2e gate in Task 7.)

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test -- vendor`
Expected: PASS (Task 2's 5 cases unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/vendor.ts
git commit -m "feat: loadVendorContext + requireActiveVendor gate"
```

---

### Task 4: `/post-login` resolver route

A route handler that sends a just-authenticated user to the right home. All post-login redirects funnel here.

**Files:**

- Create: `src/app/post-login/route.ts`

**Interfaces:**

- Consumes: `loadVendorContext`, `resolveHome` (Tasks 2-3).
- Produces: `GET /post-login` → 307 redirect to the resolved home (or `/login` if no session).

- [ ] **Step 1: Create the route** — `src/app/post-login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { loadVendorContext, resolveHome } from "@/lib/vendor";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const dest = resolveHome({
    isTeam,
    hasActiveKit: links.some((l) => l.status === "active"),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/post-login/route.ts
git commit -m "feat: /post-login role-routing resolver route"
```

---

### Task 5: Dashboard shell + tiles (`(app)` route group)

The gated vendor home. The shell lives in a `(app)` group so the pending page (Task 6) can sit at `/dashboard/pending` without inheriting the gate.

**Files:**

- Create: `src/app/dashboard/(app)/layout.tsx`
- Create: `src/app/dashboard/(app)/page.tsx`
- Create: `src/app/dashboard/(app)/vendor-kit-card.tsx`
- Create: `src/app/dashboard/(app)/loading.tsx`

**Interfaces:**

- Consumes: `requireActiveVendor`, `tilesForLinks`, `KitTile` (Tasks 2-3); `Wordmark`, `Button`, `Badge`, `signOutAction`.

- [ ] **Step 1: Create the gated layout** — `src/app/dashboard/(app)/layout.tsx`:

```tsx
import { requireActiveVendor } from "@/lib/vendor";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every gated /dashboard route once here; the page re-derives links cheaply.
  const { user } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <div className="flex items-center gap-2">
            {user.email && (
              <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create the kit card** — `src/app/dashboard/(app)/vendor-kit-card.tsx`:

```tsx
import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function VendorKitCard({ tile }: { tile: KitTile }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <Badge variant="success">Live</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      {tile.href && (
        <Button asChild size="sm" className="mt-4">
          <a href={tile.href} target="_blank" rel="noreferrer">
            Open {tile.name}
          </a>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the page** — `src/app/dashboard/(app)/page.tsx`:

```tsx
import Link from "next/link";
import { requireActiveVendor, tilesForLinks } from "@/lib/vendor";
import { VendorKitCard } from "./vendor-kit-card";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);

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

      <p className="mt-10 text-sm text-muted-foreground">
        More kits coming —{" "}
        <Link href="/" className="font-medium text-foreground hover:underline">
          see the family
        </Link>
        .
      </p>
    </>
  );
}
```

- [ ] **Step 4: Create the loading skeleton** — `src/app/dashboard/(app)/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT 0.
Run: `pnpm test`
Expected: all passing (unchanged count from Tasks 1-2 additions).

- [ ] **Step 6: Commit**

```bash
git add "src/app/dashboard/(app)"
git commit -m "feat: gated vendor dashboard shell + kit tiles"
```

---

### Task 6: Pending page (`/dashboard/pending`)

Standalone, waitlist-aware page for logged-in users with no active kit. Sits OUTSIDE the `(app)` group so the gate doesn't redirect it into a loop.

**Files:**

- Create: `src/app/dashboard/pending/page.tsx`

**Interfaces:**

- Consumes: `loadVendorContext`, `tilesForLinks` (Tasks 2-3); `Wordmark`, `Button`, `signOutAction`.

- [ ] **Step 1: Create the page** — `src/app/dashboard/pending/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadVendorContext, tilesForLinks } from "@/lib/vendor";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

// Reachable only by a signed-in user who is not an active vendor. Not under the
// (app) gate, so requireActiveVendor's redirect here can't loop. Sends anyone who
// actually qualifies onward via /post-login.
export default async function PendingPage() {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  if (isTeam) redirect("/admin");
  if (links.some((l) => l.status === "active")) redirect("/dashboard");

  const { pending } = tilesForLinks(links);

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
                , but no kits are active on this account yet. Get in touch to
                get started.
              </p>
            </>
          )}
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

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/pending/page.tsx
git commit -m "feat: waitlist-aware /dashboard/pending page"
```

---

### Task 7: Wire redirects + proxy guard + e2e + full verify

Route every post-login entry through `/post-login`, extend the session guard to `/dashboard`, add e2e coverage, and run the full gate.

**Files:**

- Modify: `src/lib/supabase/middleware.ts` (`isProtectedPath`)
- Modify: `src/app/login/page.tsx` (2 `router.push("/admin")` → `/post-login`)
- Modify: `src/app/reset-password/page.tsx` (`router.push("/admin")` → `/post-login`)
- Modify: `src/app/auth/callback/route.ts` (default destination `/admin` → `/post-login`)
- Modify: `e2e/smoke.spec.ts` (add a `/dashboard` gate test)

- [ ] **Step 1: Extend the session guard** — in `src/lib/supabase/middleware.ts`, update `isProtectedPath` (it currently returns `path.startsWith("/admin")`):

```ts
function isProtectedPath(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/dashboard");
}
```

- [ ] **Step 2: Repoint the post-login redirects** — verify exact current text first with `git grep -n '"/admin"' src/app/login/page.tsx src/app/reset-password/page.tsx`, then:
  - `src/app/login/page.tsx`: both `router.push("/admin")` → `router.push("/post-login")`.
  - `src/app/reset-password/page.tsx`: `router.push("/admin")` → `router.push("/post-login")`.
  - `src/app/auth/callback/route.ts`: the `safeNext` default `"/admin"` → `"/post-login"` (keep the same-origin `next` validation exactly as-is; only the fallback string changes).

- [ ] **Step 3: Add the e2e gate test** — in `e2e/smoke.spec.ts`, add a public-smoke test (outside the `MERQO_E2E_AUTH` authed block) after the existing public tests:

```ts
// The vendor dashboard requires a session — signed-out visitors are bounced to
// /login by the proxy guard.
test("dashboard redirects a signed-out visitor to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Full verification**

Run: `pnpm test`
Expected: all passing (Tasks 1-2 added `vendor-read` + `vendor` suites).

Run: `pnpm check`
Expected: prettier + eslint + `tsc --noEmit` clean. If prettier flags formatting, run `pnpm format` then re-run.

Run: `git grep -n '"/admin"' -- src/app/login src/app/reset-password src/app/auth`
Expected: no matches (all repointed to `/post-login`).

- [ ] **Step 5: Standards drift check**

Invoke `templatecentral:standards` over the changed files; address real findings only. Do not run other templateCentral commands.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: route post-login through /post-login, guard /dashboard, e2e"
```

---

## Self-Review

**Spec coverage:**

- Migration `0003` (grant + policy harden) → Task 1. ✅
- Role-aware routing (team/active/none) → `resolveHome` (Task 2) + `/post-login` (Task 4) + redirects (Task 7). ✅
- `requireActiveVendor` gate + `loadVendorContext` → Task 3. ✅
- `/dashboard` tiles from `kits.ts`, no `products` grant → Tasks 2 (`tilesForLinks`) + 5. ✅
- Waitlist-aware pending page, outside the gate (no loop) → Task 6 (`(app)` group in Task 5). ✅
- Proxy guard protects `/dashboard` → Task 7. ✅
- Vendor shell mirrors qkit header → Task 5. ✅
- No qkit change / no numbers / no unlock / no feedback → absent (correctly deferred). ✅
- Testing: pure `resolveHome`/`tilesForLinks` (Task 2), migration assertions (Task 1), `/dashboard` gate smoke (Task 7). ✅

**Type consistency:** `HomeDestination`, `KitTile`, `VendorLink` defined in `src/lib/vendor.ts` (Tasks 2-3) and consumed by `/post-login` (Task 4), the shell/page/card (Task 5), and pending (Task 6). `resolveHome` takes `{ isTeam, hasActiveKit }` everywhere it's called. `tilesForLinks` returns `{ active, pending }` consumed identically in Tasks 5 and 6. Names consistent.

**Placeholder scan:** none — every code step carries full content; the one "verify exact text first" edit (Task 7 Step 2) names the precise before/after strings.

**Route-loop check:** the gated shell is in `dashboard/(app)/`; `/dashboard/pending` is a sibling outside the group, so `requireActiveVendor`'s `redirect("/dashboard/pending")` lands on an ungated page — no loop. The pending page redirects qualifying users back out via explicit `redirect()` calls.
