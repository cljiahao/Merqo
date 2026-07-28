import { describe, it, expect } from "vitest";
import { tilesForLinks } from "./vendor";

describe("tilesForLinks", () => {
  it("buckets active, waitlist, and needs_setup links separately", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "shopkit", status: "waitlist", plan: null },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(pending.map((t) => t.slug)).toEqual(["shopkit"]);
    expect(needsSetup.map((t) => t.slug)).toEqual(["paykit"]);
  });

  it("drops a link to a slug KITS doesn't know about, in any bucket", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "unknown-kit", status: "needs_setup", plan: null },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
    expect(needsSetup).toEqual([]);
  });

  it("never sets plan on a needs_setup tile (plan only means anything once active)", () => {
    const { needsSetup } = tilesForLinks([
      { product_slug: "paykit", status: "needs_setup", plan: "pro" },
    ]);
    expect(needsSetup[0].plan).toBeUndefined();
  });

  it("still populates plan on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });
});
