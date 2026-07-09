import { describe, it, expect } from "vitest";
import {
  resolveHome,
  tilesForLinks,
  hasRenderableActiveKit,
  addableKits,
} from "@/lib/vendor";

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

describe("hasRenderableActiveKit", () => {
  it("is true for an active link whose slug is in KITS", () => {
    expect(
      hasRenderableActiveKit([{ product_slug: "qkit", status: "active" }]),
    ).toBe(true);
  });
  it("is false when the only active link has an unknown slug", () => {
    expect(
      hasRenderableActiveKit([{ product_slug: "ghostkit", status: "active" }]),
    ).toBe(false);
  });
  it("is false when the only known kit is waitlist, not active", () => {
    expect(
      hasRenderableActiveKit([{ product_slug: "loopkit", status: "waitlist" }]),
    ).toBe(false);
  });
});

describe("tilesForLinks plan passthrough", () => {
  it("carries plan through on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });

  it("leaves plan undefined when the link has none", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active" },
    ]);
    expect(active[0].plan).toBeUndefined();
  });
});

describe("addableKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      status: "planned" as const,
    },
  ];

  it("includes a live kit the vendor has no vendor_links row for", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).toEqual(["qkit"]);
    expect(out[0].href).toBe("https://qkit-sg.vercel.app");
  });

  it("excludes a live kit that already has any vendor_links row", () => {
    expect(addableKits([{ product_slug: "qkit" }], kits)).toEqual([]);
  });

  it("never includes a non-live kit regardless of link state", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).not.toContain("loopkit");
    expect(out.map((t) => t.slug)).not.toContain("shopkit");
  });
});
