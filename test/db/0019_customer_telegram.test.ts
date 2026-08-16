import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0019_customer_telegram.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0019_customer_telegram migration", () => {
  it("widens merqo.customers with a nullable phone and the new Telegram columns", () => {
    expect(sql).toContain("add column telegram_chat_id  bigint");
    expect(sql).toContain("add column consent_given_at  timestamptz");
    expect(sql).toContain("add column pending_notify_ref text");
    expect(sql).toContain("alter column phone drop not null");
  });

  it("replaces the (vendor_id, phone) PK with a surrogate id PK, using the REAL auto-generated constraint name", () => {
    // Postgres auto-names a table's PK constraint from the table name
    // alone (unqualified by schema) — customers_pkey, not
    // merqo_customers_pkey. Verified against a real Postgres 17 instance;
    // the master design doc's own snippet had this wrong.
    expect(sql).toContain("drop constraint customers_pkey");
    expect(sql).not.toContain("drop constraint merqo_customers_pkey");
    expect(sql).toContain(
      "add column id uuid primary key default gen_random_uuid()",
    );
  });

  it("adds the customers_identity_check constraint", () => {
    expect(sql).toContain("customers_identity_check");
    expect(sql).toContain(
      "check (phone is not null or telegram_chat_id is not null)",
    );
  });

  it("adds both partial unique indexes, not full ones", () => {
    expect(sql).toContain("create unique index customers_vendor_phone_idx");
    expect(sql).toContain("create unique index customers_vendor_telegram_idx");
    expect(sql).toMatch(
      /customers_vendor_phone_idx\s+on merqo\.customers \(vendor_id, phone\) where phone is not null/,
    );
    expect(sql).toMatch(
      /customers_vendor_telegram_idx\s+on merqo\.customers \(vendor_id, telegram_chat_id\) where telegram_chat_id is not null/,
    );
  });

  it("re-targets upsert_customer's ON CONFLICT at the new partial index", () => {
    expect(sql).toContain(
      "on conflict (vendor_id, phone) where phone is not null do update",
    );
  });

  it("creates telegram_link_tokens with RLS enabled, zero policies, and a service_role grant", () => {
    expect(sql).toContain("create table merqo.telegram_link_tokens");
    expect(sql).toContain(
      "alter table merqo.telegram_link_tokens enable row level security",
    );
    expect(sql).not.toMatch(/create policy[^;]*telegram_link_tokens/);
    expect(sql).toContain(
      "grant all on merqo.telegram_link_tokens to service_role",
    );
  });

  it("telegram_link_tokens references vendor_id, kit_slug, notify_ref, expires_at", () => {
    expect(sql).toContain(
      "vendor_id     uuid not null references auth.users(id) on delete cascade",
    );
    expect(sql).toContain("kit_slug      text not null");
    expect(sql).toContain("notify_ref    text not null");
    expect(sql).toContain("expires_at    timestamptz not null");
  });

  it("adds the three service-role-only customers RPCs, PUBLIC execute revoked", () => {
    for (const fn of [
      "merqo.upsert_customer_telegram",
      "merqo.claim_customer_by_notify_ref",
      "merqo.find_customer_telegram_by_phone",
    ]) {
      expect(sql).toContain(`create or replace function ${fn}`);
      expect(sql).toContain(`grant execute on function ${fn}`);
      expect(sql).toContain(`revoke execute on function ${fn}`);
    }
  });

  it("upsert_customer_telegram upserts on the partial telegram index and sets consent_given_at", () => {
    expect(sql).toContain(
      "on conflict (vendor_id, telegram_chat_id) where telegram_chat_id is not null do update set",
    );
    expect(sql).toContain("consent_given_at = now()");
  });

  it("claim_customer_by_notify_ref clears pending_notify_ref atomically", () => {
    expect(sql).toMatch(
      /update merqo\.customers\s+set pending_notify_ref = null\s+where vendor_id = p_vendor_id and pending_notify_ref = p_notify_ref/,
    );
  });

  it("find_customer_telegram_by_phone never writes (select only, phone mode never clears)", () => {
    const fnStart = sql.indexOf(
      "create or replace function merqo.find_customer_telegram_by_phone",
    );
    const fnBody = sql.slice(fnStart, fnStart + 500);
    expect(fnBody).toContain("select telegram_chat_id into v_chat_id");
    expect(fnBody).not.toContain("update merqo.customers");
  });
});
