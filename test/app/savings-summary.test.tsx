// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavingsSummary } from "@/app/dashboard/(app)/savings-summary";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { VendorSavings } from "@/lib/savings";

function totals(overrides: Partial<VendorSavings>): VendorSavings {
  return {
    perKit: [],
    totalHoursPerWeek: 0,
    totalCostCentsPerMonth: 0,
    totalUpsideCostCentsPerMonth: 0,
    ...overrides,
  };
}

describe("SavingsSummary", () => {
  it("renders nothing when there is no savings data", () => {
    const { container } = render(<SavingsSummary totals={totals({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the total dollar and hours figures", () => {
    render(
      <TooltipProvider>
        <SavingsSummary
          totals={totals({
            perKit: [
              {
                slug: "qkit",
                hoursPerWeek: 3,
                costCentsPerMonth: 23000,
                upsideHoursPerWeek: 3,
                upsideCostCentsPerMonth: 24000,
              },
            ],
            totalHoursPerWeek: 3,
            totalCostCentsPerMonth: 23000,
            totalUpsideCostCentsPerMonth: 24000,
          })}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText("$230")).toBeInTheDocument();
    expect(screen.getByText(/3 hrs\/week/)).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument();
    expect(screen.getByText("+$240")).toBeInTheDocument();
  });

  it("shows the Pro upgrade line only when there is upside", () => {
    render(
      <TooltipProvider>
        <SavingsSummary
          totals={totals({
            perKit: [
              {
                slug: "loopkit",
                hoursPerWeek: 4,
                costCentsPerMonth: 30000,
                upsideHoursPerWeek: 0,
                upsideCostCentsPerMonth: 0,
              },
            ],
            totalHoursPerWeek: 4,
            totalCostCentsPerMonth: 30000,
            totalUpsideCostCentsPerMonth: 0,
          })}
        />
      </TooltipProvider>,
    );
    expect(screen.queryByText(/Upgrade to Pro/)).not.toBeInTheDocument();
  });
});
