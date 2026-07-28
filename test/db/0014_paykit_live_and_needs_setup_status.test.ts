import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0014_paykit_live_and_needs_setup_status.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0014_paykit_live_and_needs_setup_status migration", () => {
  it("updates paykit status from coming_soon to live", () => {
    expect(sql).toContain(
      "update merqo.products set status = 'live' where slug = 'paykit'",
    );
  });

  it("dynamically finds and drops the existing vendor_links status check constraint", () => {
    expect(sql).toContain("pg_constraint");
    expect(sql).toContain("vendor_links");
    expect(sql).toContain("drop constraint");
  });

  it("re-adds a named constraint allowing active, waitlist, and needs_setup", () => {
    expect(sql).toContain("vendor_links_status_check");
    expect(sql).toContain(
      "check (status in ('active', 'waitlist', 'needs_setup'))",
    );
  });
});
