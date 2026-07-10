import { describe, it, expect } from "vitest";
import {
  groupVendorGrants,
  findVendorGrant,
  filterVendorGrants,
} from "@/lib/vendor-grants";

describe("groupVendorGrants", () => {
  const names = new Map([
    ["qkit", "Merqo qkit — Queue"],
    ["loopkit", "Merqo loopkit — Loyalty"],
  ]);

  it("groups multiple kit links under one vendor email", () => {
    const out = groupVendorGrants(
      [
        { email: "a@x.com", product_slug: "qkit", status: "active" },
        { email: "a@x.com", product_slug: "loopkit", status: "waitlist" },
      ],
      names,
    );
    expect(out).toHaveLength(1);
    expect(out[0].email).toBe("a@x.com");
    expect(out[0].kits.map((k) => k.slug)).toEqual(["qkit", "loopkit"]);
  });

  it("resolves the product name, falling back to the slug when unknown", () => {
    const out = groupVendorGrants(
      [{ email: "a@x.com", product_slug: "qkit", status: "active" }],
      names,
    );
    expect(out[0].kits[0].name).toBe("Merqo qkit — Queue");
    const unknown = groupVendorGrants(
      [{ email: "a@x.com", product_slug: "ghostkit", status: "active" }],
      names,
    );
    expect(unknown[0].kits[0].name).toBe("ghostkit");
  });

  it("sorts vendors by email", () => {
    const out = groupVendorGrants(
      [
        { email: "z@x.com", product_slug: "qkit", status: "active" },
        { email: "a@x.com", product_slug: "qkit", status: "active" },
      ],
      names,
    );
    expect(out.map((v) => v.email)).toEqual(["a@x.com", "z@x.com"]);
  });
});

describe("findVendorGrant", () => {
  const grants = [
    {
      email: "a@x.sg",
      kits: [{ slug: "qkit", name: "qkit", status: "active" as const }],
    },
    { email: "b@x.sg", kits: [] },
  ];
  it("matches case-insensitively", () => {
    expect(findVendorGrant(grants, "A@X.SG")?.email).toBe("a@x.sg");
  });
  it("returns null when absent", () => {
    expect(findVendorGrant(grants, "nope@x.sg")).toBeNull();
  });
});

describe("filterVendorGrants", () => {
  const grants = [
    {
      email: "alice@x.sg",
      kits: [
        { slug: "qkit", name: "QKit", status: "active" as const },
        { slug: "loopkit", name: "LoopKit", status: "waitlist" as const },
      ],
    },
    {
      email: "bob@x.sg",
      kits: [{ slug: "loopkit", name: "LoopKit", status: "active" as const }],
    },
    { email: "carol@x.sg", kits: [] },
  ];

  it("returns everything when no filters are set", () => {
    expect(filterVendorGrants(grants, {})).toEqual(grants);
  });

  it("filters by email substring, case-insensitively", () => {
    expect(filterVendorGrants(grants, { query: "ALICE" })).toEqual([grants[0]]);
  });

  it("filters by status across any kit", () => {
    expect(filterVendorGrants(grants, { status: "waitlist" })).toEqual([
      grants[0],
    ]);
  });

  it("filters by kit slug", () => {
    expect(filterVendorGrants(grants, { slug: "loopkit" })).toEqual([
      grants[0],
      grants[1],
    ]);
  });

  it("combines slug and status — must be the same kit entry", () => {
    expect(
      filterVendorGrants(grants, { slug: "loopkit", status: "active" }),
    ).toEqual([grants[1]]);
  });

  it("excludes vendors with zero kits once any filter is active", () => {
    expect(filterVendorGrants(grants, { status: "active" })).not.toContainEqual(
      grants[2],
    );
  });

  it("combines query with status/slug filters", () => {
    expect(
      filterVendorGrants(grants, { query: "bob", status: "active" }),
    ).toEqual([grants[1]]);
  });
});
