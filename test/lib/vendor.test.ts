import { describe, it, expect } from "vitest";
import { resolveHome, tilesForLinks } from "@/lib/vendor";

describe("resolveHome", () => {
  it("routes a team member to /admin regardless of kits", () => {
    expect(resolveHome({ isTeam: true, hasActiveKit: false })).toBe("/admin");
    expect(resolveHome({ isTeam: true, hasActiveKit: true })).toBe("/admin");
  });
  it("routes an active vendor to /dashboard", () => {
    expect(resolveHome({ isTeam: false, hasActiveKit: true })).toBe(
      "/dashboard",
    );
  });
  it("routes a non-active user to the pending page", () => {
    expect(resolveHome({ isTeam: false, hasActiveKit: false })).toBe(
      "/dashboard/pending",
    );
  });
});

describe("tilesForLinks", () => {
  it("splits active vs waitlist and maps slug→KITS metadata", () => {
    const { active, pending } = tilesForLinks([
      { product_slug: "qkit", status: "active" },
      { product_slug: "loopkit", status: "waitlist" },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(active[0].name).toBe("qkit");
    expect(active[0].href).toBeTruthy();
    expect(pending.map((t) => t.slug)).toEqual(["loopkit"]);
  });
  it("drops unknown/removed slugs (config is the display allow-list)", () => {
    const { active, pending } = tilesForLinks([
      { product_slug: "ghostkit", status: "active" },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
  });
});
