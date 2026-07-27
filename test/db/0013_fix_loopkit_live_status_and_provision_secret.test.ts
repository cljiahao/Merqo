import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0013_fix_loopkit_live_status_and_provision_secret.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0013_fix_loopkit_live_status_and_provision_secret migration", () => {
  it("updates loopkit status from coming_soon to live", () => {
    expect(sql).toContain(
      "update merqo.products set status = 'live' where slug = 'loopkit'",
    );
  });

  it("adds provision_secret column to products table", () => {
    expect(sql).toContain("alter table merqo.products");
    expect(sql).toContain("add column if not exists provision_secret text");
  });

  it("does not set a secret value (kept nullable for out-of-band setup)", () => {
    expect(sql).not.toContain("provision_secret text not null");
  });
});
