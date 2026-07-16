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
