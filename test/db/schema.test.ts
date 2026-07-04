import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/0001_merqo_core.sql", import.meta.url)),
  "utf8",
).toLowerCase();

describe("0001_merqo_core migration", () => {
  it("creates a dedicated merqo schema (one project, schema per kit)", () => {
    expect(sql).toMatch(/create schema (if not exists )?merqo/);
  });
  it("creates the three core tables in the merqo schema", () => {
    expect(sql).toContain("create table merqo.merqo_team");
    expect(sql).toContain("create table merqo.products");
    expect(sql).toContain("create table merqo.vendor_links");
  });
  it("defines is_merqo_team as security definer", () => {
    expect(sql).toMatch(/create (or replace )?function merqo\.is_merqo_team/);
    expect(sql).toContain("security definer");
  });
  it("exposes the schema to the data-api roles (usage grant)", () => {
    expect(sql).toMatch(/grant usage on schema merqo to[^;]*service_role/);
  });
  it("constrains product status and vendor_link status", () => {
    expect(sql).toMatch(/status[^;]*check[^;]*'live'[^;]*'coming_soon'/);
    expect(sql).toMatch(/status[^;]*check[^;]*'active'[^;]*'waitlist'/);
  });
  it("enforces one link per (email, product_slug)", () => {
    expect(sql).toMatch(/unique\s*\(\s*email\s*,\s*product_slug\s*\)/);
  });
  it("enables RLS on all three tables", () => {
    expect((sql.match(/enable row level security/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
