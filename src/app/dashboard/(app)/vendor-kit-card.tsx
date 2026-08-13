import { InfoTooltip } from "@merqo/ui";
import type { KitTile } from "@/lib/vendor";
import type { KitSavings } from "@/lib/savings";
import type { VendorMetricsResult } from "@/lib/vendor-metrics-client";
import { money, timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "./upgrade-button";
import { DowngradeButton } from "./downgrade-button";
import { VendorMetricList } from "./vendor-metric-list";

export function VendorKitCard({
  tile,
  savings,
  metrics,
  now,
}: {
  tile: KitTile;
  savings?: KitSavings;
  metrics: VendorMetricsResult;
  now: number;
}) {
  return (
    // primary treatment — this is the vendor's own live, active kit, not a pitch
    <div className="rounded-xl border bg-card p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <div className="flex items-center gap-1.5">
          {tile.plan === "pro" && <Badge variant="gold">Pro</Badge>}
          {tile.plan === "free" && <Badge variant="muted">Free</Badge>}
          <Badge variant="success">Live</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      {savings && (
        <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-sm text-foreground">
          Est.{" "}
          <span className="font-semibold">
            {money(savings.costCentsPerMonth)}
          </span>{" "}
          saved this month · ~{savings.hoursPerWeek} hrs/week back
          <InfoTooltip
            ariaLabel="How this estimate is calculated"
            content={
              <>
                A flat per-kit, per-plan estimate — not tracked from your actual
                usage. Based on ~S$18/hr (Singapore hawker-stall staff wage), ×
                hours/week this kit saves you on your current plan × 4.33
                weeks/month.
              </>
            }
          />
        </p>
      )}

      <VendorMetricList result={metrics} now={now} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tile.href && (
          <Button asChild size="sm">
            <a href={`${tile.href}/dashboard`} target="_blank" rel="noreferrer">
              Open {tile.name}
            </a>
          </Button>
        )}
        {tile.plan === "free" && <UpgradeButton slug={tile.slug} />}
        {tile.plan === "pro" && <DowngradeButton slug={tile.slug} />}
      </div>
      {tile.plan === "free" &&
        savings &&
        savings.upsideCostCentsPerMonth > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pro saves{" "}
            <span className="font-medium text-foreground">
              +{money(savings.upsideCostCentsPerMonth)}
            </span>{" "}
            more (+{savings.upsideHoursPerWeek} hrs/week)
          </p>
        )}

      {tile.lastVerifiedAt && (
        <p className="mt-3 text-[0.7rem] text-muted-foreground">
          Synced {timeAgo(tile.lastVerifiedAt, now)}
        </p>
      )}
    </div>
  );
}
