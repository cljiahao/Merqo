import { describe, expect, it } from "vitest";

import { tourSteps } from "./tour-steps";

describe("tourSteps", () => {
  it("returns 3 steps — Merqo's nav has no burger/collapse to split a desktop/mobile list on", () => {
    expect(tourSteps()).toHaveLength(3);
  });

  it("anchors every step to a data-tour selector with non-empty copy", () => {
    for (const step of tourSteps()) {
      expect(step.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it("opens on the dashboard welcome landmark and ends on the replay button", () => {
    const steps = tourSteps();
    expect(steps[0].element).toBe('[data-tour="dashboard-welcome"]');
    expect(steps[steps.length - 1].element).toBe('[data-tour="tour-replay"]');
  });

  it("spotlights the account menu in between, anchored to @merqo/ui's AccountMenu trigger", () => {
    const elements = tourSteps().map((s) => s.element);
    expect(elements).toEqual([
      '[data-tour="dashboard-welcome"]',
      '[data-tour="nav-account"]',
      '[data-tour="tour-replay"]',
    ]);
  });
});
