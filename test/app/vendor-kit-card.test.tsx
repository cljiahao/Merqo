// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorKitCard } from "@/app/dashboard/(app)/vendor-kit-card";
import { TooltipProvider } from "@/components/ui/tooltip";

const NOW = Date.parse("2026-07-26T12:00:00Z");

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
        metrics={{ ok: false, slug: "qkit" }}
        now={NOW}
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
        metrics={{ ok: false, slug: "qkit" }}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/saved this month/)).not.toBeInTheDocument();
  });

  it("renders the savings line when savings is provided", () => {
    render(
      <TooltipProvider>
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
          metrics={{ ok: false, slug: "qkit" }}
          now={NOW}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText(/saved this month/)).toBeInTheDocument();
    expect(screen.getByText("$230", { exact: false })).toBeInTheDocument();
  });

  it("shows the Pro upside line on a free-plan card with upside", () => {
    render(
      <TooltipProvider>
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
          metrics={{ ok: false, slug: "qkit" }}
          now={NOW}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText(/Pro saves/)).toBeInTheDocument();
  });

  it("omits the Pro upside line on a pro-plan card", () => {
    render(
      <TooltipProvider>
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
          metrics={{ ok: false, slug: "loopkit" }}
          now={NOW}
        />
      </TooltipProvider>,
    );
    expect(screen.queryByText(/Pro saves/)).not.toBeInTheDocument();
  });

  it("shows a last-synced line when the tile carries lastVerifiedAt", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
          lastVerifiedAt: "2026-07-26T11:57:00Z",
        }}
        metrics={{ ok: false, slug: "qkit" }}
        now={NOW}
      />,
    );
    expect(screen.getByText("Synced 3m ago")).toBeInTheDocument();
  });

  it("omits the last-synced line when the tile has never been through a sync", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
        metrics={{ ok: false, slug: "qkit" }}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/^Synced/)).not.toBeInTheDocument();
  });
});
