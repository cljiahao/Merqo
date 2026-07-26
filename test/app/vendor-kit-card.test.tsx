// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorKitCard } from "@/app/dashboard/(app)/vendor-kit-card";

describe("VendorKitCard", () => {
  it("applies the hover-lift treatment to the card root", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
      />,
    );
    const card = screen.getByText("qkit").closest("div")?.parentElement;
    expect(card?.className).toContain("hover:-translate-y-0.5");
    expect(card?.className).toContain("hover:shadow-md");
  });

  it("renders no savings line when savings is omitted", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
      />,
    );
    expect(screen.queryByText(/saved this month/)).not.toBeInTheDocument();
  });

  it("renders the savings line when savings is provided", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
        savings={{
          slug: "qkit",
          hoursPerWeek: 3,
          costCentsPerMonth: 23000,
          upsideHoursPerWeek: 3,
          upsideCostCentsPerMonth: 24000,
        }}
      />,
    );
    expect(screen.getByText(/saved this month/)).toBeInTheDocument();
    expect(screen.getByText("$230", { exact: false })).toBeInTheDocument();
  });

  it("shows the Pro upside line on a free-plan card with upside", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
        savings={{
          slug: "qkit",
          hoursPerWeek: 3,
          costCentsPerMonth: 23000,
          upsideHoursPerWeek: 3,
          upsideCostCentsPerMonth: 24000,
        }}
      />,
    );
    expect(screen.getByText(/Pro saves/)).toBeInTheDocument();
  });

  it("omits the Pro upside line on a pro-plan card", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "loopkit",
          name: "loopkit",
          tagline: "Stamp cards, points and tiers.",
          href: "https://loopkit-sg.vercel.app",
          plan: "pro",
        }}
        savings={{
          slug: "loopkit",
          hoursPerWeek: 4,
          costCentsPerMonth: 30000,
          upsideHoursPerWeek: 0,
          upsideCostCentsPerMonth: 0,
        }}
      />,
    );
    expect(screen.queryByText(/Pro saves/)).not.toBeInTheDocument();
  });
});
