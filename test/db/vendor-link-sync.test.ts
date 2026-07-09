import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0005_vendor_link_sync.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0005_vendor_link_sync migration", () => {
  it("adds a nullable last_verified_at column to vendor_links", () => {
    expect(sql).toContain("alter table merqo.vendor_links");
    expect(sql).toContain(
      "add column if not exists last_verified_at timestamptz",
    );
    // must not carry a NOT NULL — NULL is the "manually granted, never synced" marker
    expect(sql).not.toMatch(/last_verified_at timestamptz not null/);
  });
});
