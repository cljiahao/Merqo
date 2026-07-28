import { describe, it, expect } from "vitest";
import { onboardingFunnel } from "@/lib/funnel";

describe("onboardingFunnel", () => {
  it("is all zeros for no links", () => {
    expect(onboardingFunnel([], 0)).toEqual({
      waitlisted: 0,
      needsSetup: 0,
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
      needsSetup: 0,
      granted: 2,
      using: 5,
    });
  });

  it("counts needs_setup separately from waitlisted and granted", () => {
    const links = [
      { status: "active" as const },
      { status: "needs_setup" as const },
      { status: "needs_setup" as const },
      { status: "waitlist" as const },
    ];
    expect(onboardingFunnel(links, 3)).toEqual({
      waitlisted: 1,
      needsSetup: 2,
      granted: 1,
      using: 3,
    });
  });
});
