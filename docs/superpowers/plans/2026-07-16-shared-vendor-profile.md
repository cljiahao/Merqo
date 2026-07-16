# Shared Vendor Profile (stall name + social links) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared `stall_name` + `social_links` per vendor, owned by `merqo` schema, readable/writable from any kit over a same-DB Postgres function contract — no HTTP, no raw cross-schema table access — cutting qkit's existing local copy over and giving loopkit a fresh read.

**Architecture:** `merqo.vendor_profile` table (deny-all RLS, same convention as `merqo.kit_events`) plus two `SECURITY DEFINER` functions (`get_or_create_vendor_profile`, `upsert_vendor_profile`). Every kit calls them via `supabase.schema("merqo").rpc(...)` from its own Supabase client — same physical Postgres instance, no network hop. qkit backfills its existing `qkit.vendors.name`/`social_links` into the shared table, then swaps its read/write paths over; loopkit adopts the shared table fresh (nothing to migrate).

**Tech Stack:** Next.js 16 (App Router) · TypeScript strict · Supabase (`@supabase/ssr`, `@supabase/supabase-js`) · Zod · Vitest · pnpm — same stack across all three repos.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (all three repos' AGENTS.md).
- Validate all user input with Zod at every boundary (all three repos).
- Authorization lives in RLS policies / `SECURITY DEFINER` function boundary, not app code — never widen a policy to "fix" a query.
- No client, and no kit's app code, ever queries `merqo.vendor_profile` directly — only through the two RPC functions (design spec non-goal).
- `social_links` shape is `{website?, instagram?, facebook?, tiktok?}`, matching qkit's existing `socialLinksSchema` exactly (design spec data model).
- After editing a schema, add a new numbered migration in that repo's `supabase/migrations/` (all three repos' AGENTS.md).
- Design spec: `merqo/docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md`.

---

## Task 1: `merqo.vendor_profile` table + RPC functions

**Files:**

- Create: `merqo/supabase/migrations/0009_vendor_profile.sql`
- Test: `merqo/test/db/vendor-profile-schema.test.ts`

**Interfaces:**

- Produces: `merqo.vendor_profile` table (`vendor_id uuid primary key`, `stall_name text not null`, `social_links jsonb not null default '{}'`, `created_at`, `updated_at`). `merqo.get_or_create_vendor_profile(p_vendor_id uuid, p_default_stall_name text default null) returns merqo.vendor_profile`. `merqo.upsert_vendor_profile(p_vendor_id uuid, p_stall_name text, p_social_links jsonb default '{}') returns merqo.vendor_profile`. Both `SECURITY DEFINER`, granted to `authenticated, service_role`.

- [ ] **Step 1: Write the failing migration test**

```ts
// merqo/test/db/vendor-profile-schema.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0009_vendor_profile.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0009_vendor_profile migration", () => {
  it("creates merqo.vendor_profile with the required columns", () => {
    expect(sql).toContain("create table merqo.vendor_profile");
    expect(sql).toMatch(/vendor_id\s+uuid\s+primary key/);
    expect(sql).toMatch(/stall_name\s+text\s+not null/);
    expect(sql).toMatch(/social_links\s+jsonb\s+not null\s+default\s+'\{\}'/);
  });

  it("enables RLS and grants no direct client access to the table", () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).not.toMatch(/grant select on merqo\.vendor_profile/);
    expect(sql).not.toMatch(/grant update on merqo\.vendor_profile/);
  });

  it("defines get_or_create_vendor_profile as security definer with a pinned search_path", () => {
    expect(sql).toMatch(
      /create (or replace )?function merqo\.get_or_create_vendor_profile/,
    );
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set search_path\s*=\s*''/);
  });

  it("defines upsert_vendor_profile as security definer with a pinned search_path", () => {
    expect(sql).toMatch(
      /create (or replace )?function merqo\.upsert_vendor_profile/,
    );
    const upsertIdx = sql.indexOf(
      "create or replace function merqo.upsert_vendor_profile",
    );
    expect(upsertIdx).toBeGreaterThanOrEqual(0);
    expect(sql.slice(upsertIdx)).toContain("security definer");
  });

  it("grants execute on both functions to authenticated and service_role, not anon", () => {
    expect(sql).toMatch(
      /grant execute on function merqo\.get_or_create_vendor_profile[^;]*to[^;]*authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function merqo\.upsert_vendor_profile[^;]*to[^;]*authenticated/,
    );
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*anon/);
  });

  it("upsert_vendor_profile does ON CONFLICT (vendor_id) DO UPDATE", () => {
    expect(sql).toMatch(/on conflict\s*\(\s*vendor_id\s*\)\s*do update/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `merqo/`): `pnpm vitest run test/db/vendor-profile-schema.test.ts`
Expected: FAIL — `ENOENT` reading `0009_vendor_profile.sql` (file doesn't exist yet).

- [ ] **Step 3: Write the migration**

```sql
-- merqo/supabase/migrations/0009_vendor_profile.sql
-- Shared vendor identity (stall name + social links), owned by merqo so
-- every kit reads/writes one copy instead of re-onboarding it per kit. See
-- docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md.

create table merqo.vendor_profile (
  vendor_id     uuid primary key,
  stall_name    text not null,
  social_links  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS enabled with zero policies: default-deny for anon/authenticated,
-- same convention as merqo.kit_events (0008). No client queries this table
-- directly — only through the two SECURITY DEFINER functions below.
alter table merqo.vendor_profile enable row level security;

create or replace function merqo.get_or_create_vendor_profile(
  p_vendor_id uuid,
  p_default_stall_name text default null
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  select * into v_row from merqo.vendor_profile where vendor_id = p_vendor_id;
  if found then
    return v_row;
  end if;
  insert into merqo.vendor_profile (vendor_id, stall_name)
  values (p_vendor_id, coalesce(nullif(p_default_stall_name, ''), 'My Stall'))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function merqo.upsert_vendor_profile(
  p_vendor_id uuid,
  p_stall_name text,
  p_social_links jsonb default '{}'::jsonb
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  insert into merqo.vendor_profile (vendor_id, stall_name, social_links, updated_at)
  values (p_vendor_id, p_stall_name, p_social_links, now())
  on conflict (vendor_id) do update
    set stall_name   = excluded.stall_name,
        social_links = excluded.social_links,
        updated_at   = now()
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.get_or_create_vendor_profile(uuid, text) to authenticated, service_role;
grant execute on function merqo.upsert_vendor_profile(uuid, text, jsonb) to authenticated, service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/vendor-profile-schema.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Apply the migration to the shared dev DB**

Run the project's `/supabase-migrate` skill (or `supabase db push` per the repo's normal migration flow) against the shared Merqo Supabase project. This is a hard prerequisite for Task 2 — the cross-schema RPC call from qkit will fail against a stale DB that doesn't have `merqo.vendor_profile` yet.

- [ ] **Step 6: Commit**

```bash
cd merqo
git add supabase/migrations/0009_vendor_profile.sql test/db/vendor-profile-schema.test.ts
git commit -m "feat: merqo.vendor_profile table + get_or_create/upsert RPC functions"
```

---

## Task 2: Prove cross-schema RPC works from qkit (de-risking spike)

**Why this task exists:** every existing cross-kit/cross-schema call site in this codebase was audited before writing the design spec. All of them are either same-schema `supabase.rpc(...)` calls, or a Postgres trigger calling another schema's function in raw SQL (`qkit`'s `0051_emit_order_completed.sql` calling `merqo.emit_metric`). **None** of them are an app-level `supabase-js` call reaching into a schema other than the client's own configured `db.schema`. This task proves `supabase.schema("merqo").rpc(...)` actually works from qkit's real, `db: { schema: "qkit" }`-scoped client against the live shared Supabase project, before Tasks 3–6 are built on top of that assumption.

**If this task fails** (e.g. `merqo` schema is not in the Supabase project's exposed-API-schemas list, or `.schema()` chaining errors for some other reason): STOP. Do not proceed to Task 3. Escalate to the user — the documented fallback is paykit's proven bearer-secret HTTP pattern (`paykit/src/lib/kit-auth.ts`), which is a separate, larger design change not covered by this plan.

**Files:**

- Create: `qkit/test/vendor-profile-cross-schema.integration.test.ts`

**Interfaces:**

- Consumes: `merqo.get_or_create_vendor_profile(p_vendor_id uuid, p_default_stall_name text)` from Task 1, already applied to the live shared DB (Task 1 Step 5).

- [ ] **Step 1: Write the integration test**

Follow the exact opt-in pattern already established in `qkit/test/order-numbering.integration.test.ts` (real Supabase, skipped unless `RUN_DB_TESTS=1`, reads `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY`).

```ts
// qkit/test/vendor-profile-cross-schema.integration.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// De-risking spike for docs/superpowers/plans/2026-07-16-shared-vendor-profile.md
// Task 2: proves supabase.schema("merqo").rpc(...) works from a client
// configured with db.schema = "qkit" (mirrors every real qkit server
// client), against the live shared Supabase project. Opt-in like
// order-numbering.integration.test.ts — the default `pnpm test` run skips it.
//
//   PowerShell:  $env:RUN_DB_TESTS=1; pnpm test
//   bash:        RUN_DB_TESTS=1 pnpm test
const RUN = !!process.env.RUN_DB_TESTS;

function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

describe.skipIf(!RUN)(
  "merqo.vendor_profile cross-schema RPC (integration)",
  () => {
    const env = { ...loadEnvLocal(), ...process.env };
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = env.SUPABASE_SECRET_KEY;

    it("get_or_create_vendor_profile is callable via .schema('merqo').rpc(...) from a qkit-scoped client", async () => {
      if (!url || !secret)
        throw new Error(
          "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (.env.local)",
        );

      // db.schema: "qkit" — identical config to every real qkit server client
      // (src/lib/supabase/server.ts). The whole point of this test is proving
      // .schema("merqo") can override that default for one call.
      const db: SupabaseClient = createClient(url, secret, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: "qkit" },
      });

      const vendorId = randomUUID();
      const { data, error } = await db
        .schema("merqo")
        .rpc("get_or_create_vendor_profile", {
          p_vendor_id: vendorId,
          p_default_stall_name: "Spike Test Stall",
        });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        vendor_id: vendorId,
        stall_name: "Spike Test Stall",
        social_links: {},
      });
    });
  },
);
```

- [ ] **Step 2: Run it against the live shared DB**

PowerShell: `$env:RUN_DB_TESTS=1; pnpm test -- vendor-profile-cross-schema`
Expected: **This is the real de-risking check.** PASS means the cross-schema RPC pattern works and Tasks 3–7 can proceed as designed. FAIL means STOP per the "Why this task exists" note above — do not proceed, escalate to the user.

- [ ] **Step 3: Commit**

```bash
cd qkit
git add test/vendor-profile-cross-schema.integration.test.ts
git commit -m "test: prove cross-schema RPC (qkit client -> merqo function) works"
```

---

## Task 3: qkit backfill migration

**Files:**

- Create: `qkit/supabase/migrations/0053_vendor_profile_backfill.sql`
- Test: `qkit/test/db/vendor-profile-backfill.test.ts`

**Interfaces:**

- Consumes: `merqo.vendor_profile` table from Task 1, already live (Task 1 Step 5) and confirmed reachable (Task 2).
- Produces: one `merqo.vendor_profile` row per existing `qkit.vendors` row, migrated data.

- [ ] **Step 1: Write the failing migration test**

```ts
// qkit/test/db/vendor-profile-backfill.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0053_vendor_profile_backfill.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0053_vendor_profile_backfill migration", () => {
  it("inserts into merqo.vendor_profile from qkit.vendors", () => {
    expect(sql).toMatch(
      /insert into merqo\.vendor_profile\s*\(vendor_id,\s*stall_name,\s*social_links\)/,
    );
    expect(sql).toMatch(
      /select\s+id,\s*name,\s*social_links\s+from qkit\.vendors/,
    );
  });

  it("is idempotent (ON CONFLICT DO NOTHING, not a blind insert)", () => {
    expect(sql).toMatch(/on conflict\s*\(\s*vendor_id\s*\)\s*do nothing/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/db/vendor-profile-backfill.test.ts`
Expected: FAIL — `ENOENT` (migration file doesn't exist yet).

- [ ] **Step 3: Write the migration**

```sql
-- qkit/supabase/migrations/0053_vendor_profile_backfill.sql
-- One-time copy of qkit's existing local vendor identity (name,
-- social_links) into the shared merqo.vendor_profile table (merqo migration
-- 0009, must already be applied — see
-- docs/superpowers/plans/2026-07-16-shared-vendor-profile.md Task 1 Step 5).
-- ON CONFLICT DO NOTHING makes this safe to re-run. Old qkit.vendors columns
-- are dropped in a LATER, separate migration once the code swap (Tasks 4-6)
-- is deployed and verified — not here, see design spec's qkit-cutover
-- section step 4.
insert into merqo.vendor_profile (vendor_id, stall_name, social_links)
select id, name, social_links from qkit.vendors
on conflict (vendor_id) do nothing;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/db/vendor-profile-backfill.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Apply the migration to the shared dev DB**

Run `/supabase-migrate` (qkit repo). Confirm row counts match: every existing `qkit.vendors` row now has a corresponding `merqo.vendor_profile` row.

- [ ] **Step 6: Commit**

```bash
cd qkit
git add supabase/migrations/0053_vendor_profile_backfill.sql test/db/vendor-profile-backfill.test.ts
git commit -m "feat: backfill qkit.vendors identity into merqo.vendor_profile"
```

---

## Task 4: qkit cross-schema helper + entitlement read cutover

**Files:**

- Create: `qkit/src/lib/merqo-vendor-profile.ts`
- Test: `qkit/src/lib/merqo-vendor-profile.test.ts`
- Modify: `qkit/src/lib/supabase/get-entitlement.ts`

**Interfaces:**

- Produces: `getOrCreateVendorProfile(supabase: SupabaseClient, vendorId: string, defaultStallName: string | null): Promise<VendorProfile>` and `upsertVendorProfile(supabase: SupabaseClient, vendorId: string, stallName: string, socialLinks: Record<string, string>): Promise<VendorProfile>`, where `VendorProfile = { vendor_id: string; stall_name: string; social_links: Record<string, string>; created_at: string; updated_at: string }`. Consumed by `get-entitlement.ts` (this task) and `profile/actions.ts` (Task 5).

- [ ] **Step 1: Write the failing unit test**

```ts
// qkit/src/lib/merqo-vendor-profile.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  getOrCreateVendorProfile,
  upsertVendorProfile,
} from "./merqo-vendor-profile";

function makeMockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const schema = vi.fn().mockReturnValue({ rpc });
  return { client: { schema } as never, rpc, schema };
}

describe("getOrCreateVendorProfile", () => {
  it("calls .schema('merqo').rpc('get_or_create_vendor_profile', ...) with the vendor id and default name", async () => {
    const row = {
      vendor_id: "v1",
      stall_name: "Kopitiam Cart",
      social_links: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { client, rpc, schema } = makeMockClient({ data: row, error: null });

    const result = await getOrCreateVendorProfile(
      client,
      "v1",
      "Kopitiam Cart",
    );

    expect(schema).toHaveBeenCalledWith("merqo");
    expect(rpc).toHaveBeenCalledWith("get_or_create_vendor_profile", {
      p_vendor_id: "v1",
      p_default_stall_name: "Kopitiam Cart",
    });
    expect(result).toEqual(row);
  });

  it("throws with the Postgres error message on failure", async () => {
    const { client } = makeMockClient({
      data: null,
      error: { message: "connection refused" },
    });
    await expect(getOrCreateVendorProfile(client, "v1", null)).rejects.toThrow(
      "get_or_create_vendor_profile failed: connection refused",
    );
  });
});

describe("upsertVendorProfile", () => {
  it("calls .schema('merqo').rpc('upsert_vendor_profile', ...) with stall name and social links", async () => {
    const row = {
      vendor_id: "v1",
      stall_name: "New Name",
      social_links: { website: "https://example.com" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    const { client, rpc, schema } = makeMockClient({ data: row, error: null });

    const result = await upsertVendorProfile(client, "v1", "New Name", {
      website: "https://example.com",
    });

    expect(schema).toHaveBeenCalledWith("merqo");
    expect(rpc).toHaveBeenCalledWith("upsert_vendor_profile", {
      p_vendor_id: "v1",
      p_stall_name: "New Name",
      p_social_links: { website: "https://example.com" },
    });
    expect(result).toEqual(row);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/merqo-vendor-profile.test.ts`
Expected: FAIL — `Cannot find module './merqo-vendor-profile'`.

- [ ] **Step 3: Write the helper**

```ts
// qkit/src/lib/merqo-vendor-profile.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape returned by merqo's get_or_create_vendor_profile / upsert_vendor_profile.
 * merqo owns this table's real generated types — this is a hand-written
 * mirror of the RPC contract, not a generated type, since merqo.* is outside
 * qkit's own supabase gen types scope (schema: "qkit").
 */
export type VendorProfile = {
  vendor_id: string;
  stall_name: string;
  social_links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type MerqoSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_or_create_vendor_profile: {
        Args: { p_vendor_id: string; p_default_stall_name: string | null };
        Returns: VendorProfile;
      };
      upsert_vendor_profile: {
        Args: {
          p_vendor_id: string;
          p_stall_name: string;
          p_social_links: Record<string, string>;
        };
        Returns: VendorProfile;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Loose input type: this file accepts any SupabaseClient, then re-asserts
 * it against MerqoSchema for the one cross-schema call — the caller's own
 * client stays typed against its own (qkit) Database everywhere else. */
type AnyClient = SupabaseClient<never, never, never> | SupabaseClient<never>;

export async function getOrCreateVendorProfile(
  supabase: AnyClient,
  vendorId: string,
  defaultStallName: string | null,
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<MerqoSchema>;
  const { data, error } = await merqoClient
    .schema("merqo")
    .rpc("get_or_create_vendor_profile", {
      p_vendor_id: vendorId,
      p_default_stall_name: defaultStallName,
    });
  if (error) {
    throw new Error(`get_or_create_vendor_profile failed: ${error.message}`);
  }
  return data;
}

export async function upsertVendorProfile(
  supabase: AnyClient,
  vendorId: string,
  stallName: string,
  socialLinks: Record<string, string>,
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<MerqoSchema>;
  const { data, error } = await merqoClient
    .schema("merqo")
    .rpc("upsert_vendor_profile", {
      p_vendor_id: vendorId,
      p_stall_name: stallName,
      p_social_links: socialLinks,
    });
  if (error) {
    throw new Error(`upsert_vendor_profile failed: ${error.message}`);
  }
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/merqo-vendor-profile.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it into `get-entitlement.ts`**

Modify `qkit/src/lib/supabase/get-entitlement.ts`. The vendor row read (`select("*")` on `qkit.vendors`) still returns the old, soon-stale `name`/`social_links` columns (they're not dropped until a later migration, see Task 3 note) — this step overwrites them with the merqo-sourced values right after the existing `Promise.all`, before the function returns.

Replace the block from `const licenseExpiresAt = ...` to the end of the function:

```ts
    // social_links can be missing if migration 0052 hasn't reached this DB
    // yet (deploy and migrate aren't atomic) — fall back to "nothing set"
    // rather than crash the profile/booth-form pages.
    if (vendor && !vendor.social_links) {
      vendor.social_links = {};
    }

    // Stall name + social links now live in merqo.vendor_profile (shared
    // across kits) — qkit.vendors.name/social_links are stale leftovers
    // from before the cutover, not yet dropped (see 2026-07-16 plan Task 3
    // note). Overwrite with the shared source of truth so every consumer of
    // `vendor` (profile page, booth forms, order-status page) sees the
    // current value without knowing the storage moved.
    if (vendor) {
      const profile = await getOrCreateVendorProfile(
        supabase,
        vendor.id,
        vendor.name,
      );
      vendor.name = profile.stall_name;
      vendor.social_links = profile.social_links;
    }

    const licenseExpiresAt = vendor ? (license?.expires_at ?? null) : null;
    return {
      user,
      vendor: vendor ?? null,
      entitlement: getEntitlement(
        vendor?.plan ?? "free",
        licenseExpiresAt,
        now,
      ),
      licenseExpiresAt,
    };
  },
);
```

Add the import at the top of the file:

```ts
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
```

- [ ] **Step 6: Run the full qkit test suite**

Run: `pnpm check && pnpm test`
Expected: PASS. If `get-entitlement`-dependent tests mock `supabase.from("vendors")` without mocking `getOrCreateVendorProfile`, update those mocks to also stub `merqo-vendor-profile`'s export (via `vi.mock("@/lib/merqo-vendor-profile", ...)`) — find them with `grep -rl "loadEntitlement\|requireEntitledVendor" qkit/src --include=*.test.ts*`.

- [ ] **Step 7: Commit**

```bash
cd qkit
git add src/lib/merqo-vendor-profile.ts src/lib/merqo-vendor-profile.test.ts src/lib/supabase/get-entitlement.ts
git commit -m "feat: read vendor stall name/social links from merqo.vendor_profile"
```

---

## Task 5: qkit profile-page write cutover

**Files:**

- Modify: `qkit/src/app/dashboard/profile/actions.ts`

**Interfaces:**

- Consumes: `upsertVendorProfile` from Task 4.

- [ ] **Step 1: Write the failing test**

Check whether `qkit/src/app/dashboard/profile/actions.test.ts` already exists (it likely does not, per the earlier grep — only `.test.tsx` for the form component was found). Create it:

```ts
// qkit/src/app/dashboard/profile/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertVendorProfile = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/merqo-vendor-profile", () => ({ upsertVendorProfile }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateStallName, updateSocialLinks } from "./actions";

beforeEach(() => {
  upsertVendorProfile.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "v1" } } });
});

describe("updateStallName", () => {
  it("calls upsertVendorProfile with the new name and existing social links unset (name-only save)", async () => {
    upsertVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "New Name",
      social_links: {},
    });
    const result = await updateStallName({ name: "New Name" });
    expect(result.success).toBe(true);
    expect(upsertVendorProfile).toHaveBeenCalled();
  });

  it("returns an error for an invalid name without calling upsertVendorProfile", async () => {
    const result = await updateStallName({ name: "" });
    expect(result.success).toBe(false);
    expect(upsertVendorProfile).not.toHaveBeenCalled();
  });
});

describe("updateSocialLinks", () => {
  it("calls upsertVendorProfile with the parsed links", async () => {
    upsertVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Existing",
      social_links: { website: "https://example.com" },
    });
    const result = await updateSocialLinks({ website: "https://example.com" });
    expect(result.success).toBe(true);
    expect(upsertVendorProfile).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/profile/actions.test.ts`
Expected: FAIL — current `actions.ts` calls `supabase.from("vendors").update(...)`, not `upsertVendorProfile`, so the mock assertion `expect(upsertVendorProfile).toHaveBeenCalled()` fails.

- [ ] **Step 3: Rewrite `actions.ts`**

Both actions need the vendor's _current_ stall name/social links to do a partial update (`upsert_vendor_profile` always writes both fields — see Task 1's function signature) — read the current profile first via `getOrCreateVendorProfile`, then upsert with the one field changed.

```ts
// qkit/src/app/dashboard/profile/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  getOrCreateVendorProfile,
  upsertVendorProfile,
} from "@/lib/merqo-vendor-profile";
import {
  profileNameSchema,
  socialLinksSchema,
  type ProfileNameInput,
  type SocialLinksInput,
} from "@/lib/schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * Update the vendor's stall name. Persisted in merqo.vendor_profile (shared
 * across kits, see docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md)
 * via the upsert_vendor_profile RPC — not a local qkit.vendors write.
 */
export async function updateStallName(
  input: ProfileNameInput,
): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid stall name",
    };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  try {
    const current = await getOrCreateVendorProfile(supabase, user.id, null);
    await upsertVendorProfile(
      supabase,
      user.id,
      parsed.data.name,
      current.social_links,
    );
  } catch (err) {
    console.error(
      "updateStallName failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not save stall name" };
  }

  // Refresh the layout so the header + account menu pick up the new name.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

/**
 * Update the vendor's profile-level default social/website links. Same
 * merqo.vendor_profile write path as updateStallName.
 */
export async function updateSocialLinks(
  input: SocialLinksInput,
): Promise<ActionResult> {
  const parsed = socialLinksSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid links",
    };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  try {
    const current = await getOrCreateVendorProfile(supabase, user.id, null);
    await upsertVendorProfile(
      supabase,
      user.id,
      current.stall_name,
      parsed.data,
    );
  } catch (err) {
    console.error(
      "updateSocialLinks failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not save links" };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/profile/actions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full qkit test suite**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd qkit
git add src/app/dashboard/profile/actions.ts src/app/dashboard/profile/actions.test.ts
git commit -m "feat: write vendor profile updates through merqo.upsert_vendor_profile"
```

---

## Task 6: qkit order-status page read cutover

**Files:**

- Modify: `qkit/src/app/order/[boothId]/[orderNumber]/page.tsx`

**Interfaces:**

- Consumes: `getOrCreateVendorProfile` from Task 4.

- [ ] **Step 1: Locate and update the vendor social-links read**

This page has its own separate raw read of vendor social links (not routed through `get-entitlement.ts`, since it's a public/customer-facing page using the service-role client). Find the block:

```ts
const { data: vendorRow } = booth?.vendor_id
  ? await supabase
      .from("vendors")
      .select("social_links")
      .eq("id", booth.vendor_id)
      .maybeSingle()
  : { data: null };
const socialLinks = resolveSocialLinks(
  booth?.social_links ? parseSocialLinks(booth.social_links) : null,
  parseSocialLinks(vendorRow?.social_links),
);
```

Replace it with:

```ts
const vendorProfile = booth?.vendor_id
  ? await getOrCreateVendorProfile(supabase, booth.vendor_id, null)
  : null;
const socialLinks = resolveSocialLinks(
  booth?.social_links ? parseSocialLinks(booth.social_links) : null,
  parseSocialLinks(vendorProfile?.social_links ?? null),
);
```

Add the import at the top of the file:

```ts
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
```

- [ ] **Step 2: Check for existing tests on this page**

Run: `grep -rl "orderNumber\]/page" qkit/src qkit/test qkit/e2e --include=*.test.* --include=*.spec.*`
If a test mocks `.from("vendors")` for this page, update the mock to instead mock `@/lib/merqo-vendor-profile`'s `getOrCreateVendorProfile` returning `{ social_links: {...} }`.

- [ ] **Step 3: Run the full qkit test suite**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd qkit
git add src/app/order/\[boothId\]/\[orderNumber\]/page.tsx
git commit -m "feat: read vendor social links from merqo.vendor_profile on order-status page"
```

---

## Task 7: loopkit fresh adoption

**Files:**

- Create: `loopkit/src/lib/merqo-vendor-profile.ts`
- Test: `loopkit/src/lib/merqo-vendor-profile.test.ts`
- Modify: `loopkit/src/app/setup/page.tsx`

**Interfaces:**

- Produces: `getOrCreateVendorProfile(supabase, vendorId, defaultStallName): Promise<VendorProfile>` — same contract as qkit's Task 4 helper (loopkit has no local vendor-identity data to migrate, so no `upsertVendorProfile` call site yet — non-goal per design spec, no settings UI in this plan).

- [ ] **Step 1: Write the failing unit test**

```ts
// loopkit/src/lib/merqo-vendor-profile.test.ts
import { describe, it, expect, vi } from "vitest";
import { getOrCreateVendorProfile } from "./merqo-vendor-profile";

function makeMockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const schema = vi.fn().mockReturnValue({ rpc });
  return { client: { schema } as never, rpc, schema };
}

describe("getOrCreateVendorProfile", () => {
  it("calls .schema('merqo').rpc('get_or_create_vendor_profile', ...) with the vendor id and default name", async () => {
    const row = {
      vendor_id: "v1",
      stall_name: "Kopi Corner",
      social_links: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { client, rpc, schema } = makeMockClient({ data: row, error: null });

    const result = await getOrCreateVendorProfile(client, "v1", "Kopi Corner");

    expect(schema).toHaveBeenCalledWith("merqo");
    expect(rpc).toHaveBeenCalledWith("get_or_create_vendor_profile", {
      p_vendor_id: "v1",
      p_default_stall_name: "Kopi Corner",
    });
    expect(result).toEqual(row);
  });

  it("throws with the Postgres error message on failure", async () => {
    const { client } = makeMockClient({
      data: null,
      error: { message: "connection refused" },
    });
    await expect(getOrCreateVendorProfile(client, "v1", null)).rejects.toThrow(
      "get_or_create_vendor_profile failed: connection refused",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/merqo-vendor-profile.test.ts`
Expected: FAIL — `Cannot find module './merqo-vendor-profile'`.

- [ ] **Step 3: Write the helper**

Identical pattern to qkit's Task 4 helper, minus `upsertVendorProfile` (not needed by any call site in this task):

```ts
// loopkit/src/lib/merqo-vendor-profile.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape returned by merqo's get_or_create_vendor_profile. merqo owns this
 * table's real generated types — this is a hand-written mirror of the RPC
 * contract, not a generated type, since merqo.* is outside loopkit's own
 * supabase gen types scope (schema: "loopkit").
 */
export type VendorProfile = {
  vendor_id: string;
  stall_name: string;
  social_links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type MerqoSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_or_create_vendor_profile: {
        Args: { p_vendor_id: string; p_default_stall_name: string | null };
        Returns: VendorProfile;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AnyClient = SupabaseClient<never, never, never> | SupabaseClient<never>;

export async function getOrCreateVendorProfile(
  supabase: AnyClient,
  vendorId: string,
  defaultStallName: string | null,
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<MerqoSchema>;
  const { data, error } = await merqoClient
    .schema("merqo")
    .rpc("get_or_create_vendor_profile", {
      p_vendor_id: vendorId,
      p_default_stall_name: defaultStallName,
    });
  if (error) {
    throw new Error(`get_or_create_vendor_profile failed: ${error.message}`);
  }
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/merqo-vendor-profile.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Display stall name on `/setup`**

Modify `loopkit/src/app/setup/page.tsx`. After `await requireVendor();`, fetch the profile and pass the stall name into the header:

```ts
const { user } = await requireVendor();
await applyDueCutovers();
const supabase = await createServerClient();
const vendorProfile = await getOrCreateVendorProfile(
  supabase,
  user.id,
  user.email ?? null,
);
```

Add imports at the top of the file:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
```

Add the stall name under the `<Wordmark />` in the header block (inside `<div className="mb-8 text-center">`, right after the `<Wordmark className="text-3xl" />` line):

```tsx
          <Wordmark className="text-3xl" />
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {vendorProfile.stall_name}
          </p>
```

- [ ] **Step 6: Write a component-level test for the new header text**

Check `loopkit/src/app/setup/page.tsx` for any existing page-level test (`grep -rl "SetupPage" loopkit/src loopkit/e2e`). If none exists (matches the qkit precedent where `/post-login` also has no dedicated route test), skip — covered by `merqo-vendor-profile.test.ts`'s unit coverage plus manual verification, same convention already used elsewhere in this codebase (self-serve-kit-toggle spec's Testing section, `/post-login` row).

- [ ] **Step 7: Run the full loopkit test suite**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd loopkit
git add src/lib/merqo-vendor-profile.ts src/lib/merqo-vendor-profile.test.ts src/app/setup/page.tsx
git commit -m "feat: read shared vendor stall name from merqo.vendor_profile on /setup"
```

---

## Deferred — not part of this plan

Per the design spec's qkit-cutover step 4: dropping `qkit.vendors.name` and `qkit.vendors.social_links` is a **separate, later migration**, run only after Tasks 4–6 are deployed and verified in production for at least one full deploy cycle. Do not add that migration as part of executing this plan — track it as a follow-up once the cutover above is confirmed working live.

## Self-review notes

- **Spec coverage:** all 4 Goal items and all qkit-cutover/loopkit-adoption sections from the design spec map to a task above (Task 1 = schema+functions, Task 2 = de-risk the access pattern, Task 3 = backfill, Tasks 4–6 = qkit cutover's 3 read/write call sites, Task 7 = loopkit adoption). The spec's explicit non-goal (column drop deferred) is called out above, not silently dropped.
- **Placeholder scan:** no TBD/TODO; every step has real code or an exact command.
- **Type consistency:** `VendorProfile` shape (`vendor_id`, `stall_name`, `social_links`, `created_at`, `updated_at`) is identical across Task 1's SQL return type, Task 4's qkit helper, and Task 7's loopkit helper — checked by hand across all three.
