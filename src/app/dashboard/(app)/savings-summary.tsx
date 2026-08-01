import { money } from "@/lib/format";
import type { VendorSavings } from "@/lib/savings";
import { InfoTooltip } from "@/components/info-tooltip";

/** Page-level total of the per-card savings estimates — see
 *  VendorKitCard for the per-kit line and savings.ts for the numbers. */
export function SavingsSummary({ totals }: { totals: VendorSavings }) {
  if (totals.perKit.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm">
      <p className="inline-flex flex-wrap items-center gap-1">
        Est.{" "}
        <span className="font-semibold text-foreground">
          {money(totals.totalCostCentsPerMonth)}
        </span>{" "}
        saved this month · ~{totals.totalHoursPerWeek} hrs/week back across your
        kits
        <InfoTooltip ariaLabel="How this estimate is calculated">
          A flat per-kit, per-plan estimate — not tracked from your actual
          usage. Based on ~S$18/hr (Singapore hawker-stall staff wage), ×
          hours/week the kit saves you on that plan × 4.33 weeks/month. Free vs.
          Pro estimates differ per kit.
        </InfoTooltip>
      </p>
      {totals.totalUpsideCostCentsPerMonth > 0 && (
        <p className="mt-1 text-muted-foreground">
          Upgrade to Pro to save{" "}
          <span className="font-semibold text-foreground">
            +{money(totals.totalUpsideCostCentsPerMonth)}
          </span>{" "}
          more
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Estimated</p>
    </div>
  );
}
