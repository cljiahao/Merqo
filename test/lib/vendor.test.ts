import { describe, it, expect } from "vitest";
import {
  resolveHome,
  dashboardGateDestination,
  tilesForLinks,
  hasRenderableActiveKit,
  addableKits,
  comingKits,
  provisionableKits,
  hasActiveLinkFor,
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

describe("dashboardGateDestination", () => {
  it("allows /dashboard for a dual-role account (team + active kit)", () => {
    expect(dashboardGateDestination(true, true)).toBe("/dashboard");
  });
  it("allows /dashboard for a plain active vendor", () => {
    expect(dashboardGateDestination(false, true)).toBe("/dashboard");
  });
  it("blocks to /admin for a team member with no active kit", () => {
    expect(dashboardGateDestination(true, false)).toBe("/admin");
  });
  it("blocks to /dashboard/pending for a non-team user with no active kit", () => {
    expect(dashboardGateDestination(false, false)).toBe("/dashboard/pending");
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

describe("tilesForLinks lastVerifiedAt passthrough", () => {
  it("carries last_verified_at through on an active tile", () => {
    const { active } = tilesForLinks([
      {
        product_slug: "qkit",
        status: "active",
        last_verified_at: "2026-07-09T00:00:00.000Z",
      },
    ]);
    expect(active[0].lastVerifiedAt).toBe("2026-07-09T00:00:00.000Z");
  });

  it("leaves lastVerifiedAt undefined on a pending (waitlist) tile", () => {
    const { pending } = tilesForLinks([
      {
        product_slug: "loopkit",
        status: "waitlist",
        last_verified_at: "2026-07-09T00:00:00.000Z",
      },
    ]);
    expect(pending[0].lastVerifiedAt).toBeUndefined();
  });
});

describe("addableKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      description: "Take orders and run your queue from a QR code.",
      features: ["QR ordering", "Live dashboard", "No app needed"],
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      description: "Digital stamp cards and points that bring customers back.",
      features: ["Stamp cards", "Points", "Rewards"],
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      description: "A lightweight online storefront for your catalog.",
      features: ["Storefront", "Checkout", "Pre-orders"],
      status: "planned" as const,
    },
  ];

  it("includes a live kit the vendor has no vendor_links row for", () => {
    const out = addableKits([], kits);
    expect(out.map((t) => t.slug)).toEqual(["qkit"]);
    expect(out[0].href).toBe("https://qkit-sg.vercel.app");
    expect(out[0].description).toBeTruthy();
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

describe("provisionableKits", () => {
  // paykit deliberately mirrors the real bug this was found from: kits.ts
  // marks it "live" (a display tier) but it has no vendor-provision route,
  // so it's absent from `liveSlugs` (the actual capability signal, derived
  // from merqo.products.provision_secret).
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      description: "Take orders and run your queue from a QR code.",
      features: ["QR ordering", "Live dashboard", "No app needed"],
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      description: "Digital stamp cards and points that bring customers back.",
      features: ["Stamp cards", "Points", "Rewards"],
      status: "live" as const,
      href: "https://loopkit-sg.vercel.app",
    },
    {
      slug: "paykit",
      name: "paykit",
      tagline: "Collect PayNow, cards and cash.",
      description: "Collect payment however your customer prefers.",
      features: ["PayNow", "Cards", "Receipts"],
      status: "live" as const,
      href: "https://paykit-sg.vercel.app",
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      description: "A lightweight online storefront for your catalog.",
      features: ["Storefront", "Checkout", "Pre-orders"],
      status: "coming" as const,
    },
  ];
  const liveSlugs = new Set(["qkit", "loopkit"]);

  it("includes a live-and-provisionable kit the vendor has no vendor_links row for", () => {
    const out = provisionableKits([], liveSlugs, kits);
    expect(out.map((k) => k.slug)).toEqual(["qkit", "loopkit"]);
  });

  it("excludes a kit marked live in kits.ts but absent from liveSlugs (no provisioning capability)", () => {
    const out = provisionableKits([], liveSlugs, kits);
    expect(out.map((k) => k.slug)).not.toContain("paykit");
  });

  it("excludes a provisionable kit the vendor already has any vendor_links row for", () => {
    expect(
      provisionableKits([{ product_slug: "qkit" }], liveSlugs, kits),
    ).toEqual([kits[1]]);
  });

  it("never includes a non-live kit even if its slug is (implausibly) in liveSlugs", () => {
    const out = provisionableKits(
      [],
      new Set(["qkit", "loopkit", "shopkit"]),
      kits,
    );
    expect(out.map((k) => k.slug)).not.toContain("shopkit");
  });
});

describe("comingKits", () => {
  const kits = [
    {
      slug: "qkit",
      name: "qkit",
      tagline: "Take orders and run your queue.",
      description: "Take orders and run your queue from a QR code.",
      features: ["QR ordering", "Live dashboard", "No app needed"],
      status: "live" as const,
      href: "https://qkit-sg.vercel.app",
    },
    {
      slug: "loopkit",
      name: "loopkit",
      tagline: "Stamp cards and points.",
      description: "Digital stamp cards and points that bring customers back.",
      features: ["Stamp cards", "Points", "Rewards"],
      status: "coming" as const,
    },
    {
      slug: "shopkit",
      name: "shopkit",
      tagline: "A simple storefront.",
      description: "A lightweight online storefront for your catalog.",
      features: ["Storefront", "Checkout", "Pre-orders"],
      status: "planned" as const,
    },
  ];

  it("includes a coming kit the vendor has no vendor_links row for", () => {
    const out = comingKits([], kits);
    expect(out.map((k) => k.slug)).toEqual(["loopkit"]);
  });

  it("excludes a coming kit the vendor already waitlisted for", () => {
    expect(comingKits([{ product_slug: "loopkit" }], kits)).toEqual([]);
  });

  it("never includes a live or planned kit", () => {
    const out = comingKits([], kits);
    expect(out.map((k) => k.slug)).not.toContain("qkit");
    expect(out.map((k) => k.slug)).not.toContain("shopkit");
  });
});

describe("hasActiveLinkFor", () => {
  it("is true for a matching active link", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "qkit", status: "active" }], "qkit"),
    ).toBe(true);
  });

  it("is false for a waitlist link to the same slug", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "qkit", status: "waitlist" }], "qkit"),
    ).toBe(false);
  });

  it("is false when there's no link at all", () => {
    expect(hasActiveLinkFor([], "qkit")).toBe(false);
  });

  it("is false for an active link to a different slug", () => {
    expect(
      hasActiveLinkFor([{ product_slug: "loopkit", status: "active" }], "qkit"),
    ).toBe(false);
  });
});
