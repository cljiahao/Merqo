// Pure step config for the dashboard onboarding tour. No driver.js import here
// so it stays node-unit-testable; the controller maps these to driver's Config.

export type TourStep = {
  /** CSS selector for the element to spotlight. */
  element: string;
  title: string;
  description: string;
};

const sel = (tour: string) => `[data-tour="${tour}"]`;

// Merqo's dashboard nav is just a brand wordmark + an account-menu trigger —
// no burger, no nav links, nothing that collapses on a narrow viewport (see
// docs/superpowers/specs/2026-08-01-dashboard-nav-standard-design.md's "out of
// scope" note on Merqo's minimal nav). So there is one step list, not the
// desktop/mobile pair qkit/stockkit need.
const STEPS: TourStep[] = [
  {
    element: sel("dashboard-welcome"),
    title: "Welcome to Merqo",
    description:
      "This is your home base — every kit you run shows up here as a card, with live metrics pulled straight from each one.",
  },
  {
    element: sel("account-menu"),
    title: "Your account",
    description:
      "Update your profile, get help, or send feedback from here — shared across every Merqo kit you use.",
  },
  {
    element: sel("tour-replay"),
    title: "Replay anytime",
    description:
      "Tap here to run this tour again whenever you like. Now — take a look at your kits below →",
  },
];

/** The tour steps for the dashboard overview page. */
export function tourSteps(): TourStep[] {
  return STEPS;
}
