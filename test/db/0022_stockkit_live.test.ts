import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0022_stockkit_live.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0022_stockkit_live migration", () => {
  it("updates stockkit status from coming_soon to live", () => {
    expect(sql).toContain(
      "update merqo.products set status = 'live' where slug = 'stockkit'",
    );
  });
});
