import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0004_kit_consolidation.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0004_kit_consolidation migration", () => {
  it("adds the new kit rows", () => {
    for (const slug of ["paykit", "stockkit", "reachkit"]) {
      expect(sql).toContain(`'${slug}'`);
    }
  });

  it("sets each kit's app_url", () => {
    expect(sql).toMatch(/app_url/);
    expect(sql).toContain("qkit-sg.vercel.app");
  });

  it("carries tapkit waitlist links onto paykit BEFORE dropping tapkit", () => {
    const carry = sql.indexOf("set product_slug = 'paykit'");
    const delLinks = sql.indexOf(
      "delete from merqo.vendor_links where product_slug = 'tapkit'",
    );
    expect(carry).toBeGreaterThanOrEqual(0);
    expect(delLinks).toBeGreaterThan(carry); // FK-safe ordering
  });

  it("retires tapkit and slotkit from products", () => {
    expect(sql).toMatch(
      /delete from merqo\.products where slug in \('tapkit', 'slotkit'\)/,
    );
  });
});
