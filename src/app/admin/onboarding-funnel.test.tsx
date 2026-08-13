// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingFunnelView } from "./onboarding-funnel";

describe("OnboardingFunnelView", () => {
  it("renders each stage's raw count with no stage-to-stage percentage", () => {
    // A realistic shape where granted (and using) outnumber waitlisted —
    // expected per OnboardingCounts' contract, not an edge case. A naive
    // "% of previous stage" figure would print 200% here.
    render(
      <OnboardingFunnelView
        counts={{ waitlisted: 1, needsSetup: 0, granted: 2, using: 5 }}
      />,
    );

    expect(screen.getByText("Waitlisted")).toBeInTheDocument();
    expect(screen.getByText("Granted")).toBeInTheDocument();
    expect(screen.getByText("Using")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
