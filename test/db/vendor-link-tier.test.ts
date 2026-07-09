import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0006_vendor_link_tier.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0006_vendor_link_tier migration", () => {
  it("adds a nullable plan column to vendor_links", () => {
    expect(sql).toContain("alter table merqo.vendor_links");
    expect(sql).toContain("add column if not exists plan text");
    // must not carry a NOT NULL — NULL means "never synced with a plan value"
    expect(sql).not.toMatch(/plan text not null/);
  });
});
