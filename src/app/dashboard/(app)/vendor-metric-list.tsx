import type { VendorMetricsResult } from "@/lib/vendor-metrics-client";
import { timeAgo } from "@/lib/format";

/** The kit tile's stats block — a headline number (the kit's first metric,
 *  in the gold "value moment" accent per the Control Room system) plus up
 *  to three supporting figures. A kit that hasn't implemented the
 *  vendor-metrics endpoint yet (or is briefly unreachable) reads as a
 *  pending feature, not a broken one — see
 *  docs/superpowers/specs/2026-07-26-vendor-stats-overview-design.md. */
export function VendorMetricList({
  result,
  now,
}: {
  result: VendorMetricsResult;
  now: number;
}) {
  if (!result.ok || result.data.metrics.length === 0) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Stats aren&apos;t connected here yet.
      </p>
    );
  }

  const [headline, ...rest] = result.data.metrics;

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums text-gold">
          {headline.value}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {headline.label}
        </span>
      </div>
      {headline.hint && (
        <p className="mt-0.5 text-xs text-muted-foreground">{headline.hint}</p>
      )}

      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rest.slice(0, 3).map((m) => (
            <span
              key={m.key}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
            >
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium tabular-nums">{m.value}</span>
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        As of {timeAgo(result.data.generated_at, now)}
      </p>
    </div>
  );
}
