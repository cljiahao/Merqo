import { describe, it, expect } from "vitest";
import { KITS, LIVE_KITS, COMING_KITS, WAITLISTABLE_SLUGS } from "@/lib/kits";

describe("kit family config", () => {
  it("has qkit as the one live kit with a link", () => {
    expect(LIVE_KITS).toHaveLength(1);
    expect(LIVE_KITS[0].slug).toBe("qkit");
    expect(LIVE_KITS[0].href).toBeTruthy();
  });

  it("every kit has a plain-language tagline", () => {
    for (const k of KITS) expect(k.tagline.length).toBeGreaterThan(10);
  });

  it("only coming kits are waitlistable (not live or planned)", () => {
    expect(WAITLISTABLE_SLUGS).toEqual(COMING_KITS.map((k) => k.slug));
    expect(WAITLISTABLE_SLUGS).not.toContain("qkit");
    expect(WAITLISTABLE_SLUGS).not.toContain("tapkit");
    expect(WAITLISTABLE_SLUGS.length).toBeGreaterThan(0);
  });

  it("has unique slugs", () => {
    const slugs = KITS.map((k) => k.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
