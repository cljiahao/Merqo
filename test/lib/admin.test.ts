import { describe, it, expect } from "vitest";
import { groupVendorGrants } from "@/lib/admin";

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
