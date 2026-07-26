import { money } from "@/lib/format";
import type { VendorSavings } from "@/lib/savings";

/** Page-level total of the per-card savings estimates — see
 *  VendorKitCard for the per-kit line and savings.ts for the numbers. */
export function SavingsSummary({ totals }: { totals: VendorSavings }) {
  if (totals.perKit.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm">
      <p>
        Est.{" "}
        <span className="font-semibold text-foreground">
          {money(totals.totalCostCentsPerMonth)}
        </span>{" "}
        saved this month · ~{totals.totalHoursPerWeek} hrs/week back across your
        kits
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
