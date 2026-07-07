import { describe, it, expect } from "vitest";
import { onboardingFunnel } from "@/lib/funnel";

describe("onboardingFunnel", () => {
  it("is all zeros for no links", () => {
    expect(onboardingFunnel([], 0)).toEqual({
      waitlisted: 0,
      granted: 0,
      using: 0,
    });
  });

  it("counts active as granted and waitlist as waitlisted", () => {
    const links = [
      { status: "active" as const },
      { status: "active" as const },
      { status: "waitlist" as const },
    ];
    expect(onboardingFunnel(links, 5)).toEqual({
      waitlisted: 1,
      granted: 2,
      using: 5,
    });
  });
});
