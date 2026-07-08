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
