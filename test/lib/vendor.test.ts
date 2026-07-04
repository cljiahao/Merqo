import { describe, it, expect } from "vitest";
import { mergeCatalog } from "@/lib/vendor";

describe("mergeCatalog", () => {
  const products = [
    { slug: "qkit", name: "Queue", status: "live" as const, app_url: "https://q" },
    { slug: "loopkit", name: "Loyalty", status: "coming_soon" as const, app_url: null },
  ];
  it("annotates owned status from links, null when no link", () => {
    const cat = mergeCatalog(products, [{ product_slug: "qkit", status: "active" }]);
    expect(cat.find((c) => c.slug === "qkit")?.owned).toBe("active");
    expect(cat.find((c) => c.slug === "loopkit")?.owned).toBeNull();
  });
  it("maps waitlist links", () => {
    const cat = mergeCatalog(products, [{ product_slug: "loopkit", status: "waitlist" }]);
    expect(cat.find((c) => c.slug === "loopkit")?.owned).toBe("waitlist");
  });
});
