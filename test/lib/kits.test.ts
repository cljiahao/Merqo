import { describe, it, expect } from "vitest";
import { KITS, LIVE_KITS, COMING_KITS, WAITLISTABLE_SLUGS } from "@/lib/kits";

describe("kit family config", () => {
  it("has the six consolidated kits", () => {
    expect(KITS.map((k) => k.slug)).toEqual([
      "qkit",
      "loopkit",
      "shopkit",
      "paykit",
      "stockkit",
      "reachkit",
    ]);
  });

  it("has qkit as the one live kit with a link", () => {
    expect(LIVE_KITS).toHaveLength(1);
    expect(LIVE_KITS[0].slug).toBe("qkit");
    expect(LIVE_KITS[0].href).toBeTruthy();
  });

  it("sets href only on live kits (no dead links to unlaunched kits)", () => {
    for (const k of KITS) {
      if (k.status !== "live") expect(k.href).toBeUndefined();
    }
  });

  it("dropped slotkit and renamed tapkit away", () => {
    const slugs = KITS.map((k) => k.slug);
    expect(slugs).not.toContain("slotkit");
    expect(slugs).not.toContain("tapkit");
  });

  it("every kit has a plain-language tagline", () => {
    for (const k of KITS) expect(k.tagline.length).toBeGreaterThan(10);
  });

  it("only coming kits are waitlistable (not live or planned)", () => {
    expect(WAITLISTABLE_SLUGS).toEqual(COMING_KITS.map((k) => k.slug));
    expect(WAITLISTABLE_SLUGS).not.toContain("qkit");
    expect(WAITLISTABLE_SLUGS.length).toBeGreaterThan(0);
  });

  it("has unique slugs", () => {
    const slugs = KITS.map((k) => k.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every kit has a fuller description and at least 3 feature bullets", () => {
    for (const k of KITS) {
      expect(k.description.length).toBeGreaterThan(30);
      expect(k.features.length).toBeGreaterThanOrEqual(3);
      for (const f of k.features) expect(f.length).toBeGreaterThan(5);
    }
  });
});
