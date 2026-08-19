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
      "This is your home base. Every kit you run shows up here as a card, with live metrics pulled straight from each one.",
  },
  {
    element: sel("kit-cards"),
    title: "Your kits",
    description:
      'Tap a card to open that kit\'s own dashboard. A kit you have not activated yet shows up here too, so you can turn it on whenever you are ready.<div class="tour-example"><div class="tour-example-label">Example kit card</div><div class="tour-example-row" style="margin-top:0.35rem"><strong>qkit &middot; 128 orders this month</strong><span class="tour-example-pill">Free</span></div></div>',
  },
  {
    // "nav-account", not "account-menu": @merqo/ui's AccountMenu hardcodes
    // data-tour="nav-account" on its trigger button, and merqo's own
    // AccountMenu now composes that shared component instead of rendering
    // its own trigger markup.
    element: sel("nav-account"),
    title: "Your account",
    description:
      "Update your profile, get help, or send feedback from here. Shared across every Merqo kit you use.",
  },
  {
    element: sel("tour-replay"),
    title: "Replay anytime",
    description:
      "Tap here to run this tour again whenever you like. Take a look at your kits below.",
  },
];

/** The tour steps for the dashboard overview page. */
export function tourSteps(): TourStep[] {
  return STEPS;
}
