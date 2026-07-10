import { ArrowDown, ArrowUp, DollarSign, Users } from "lucide-react";
import type { MetricsResult } from "@/lib/metrics-client";
import { classifyHealth, type HealthStatus } from "@/lib/health";
import { money, computeTrend } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const HEALTH: Record<
  HealthStatus,
  { label: string; variant: "success" | "gold" | "destructive" }
> = {
  reporting: { label: "Reporting", variant: "success" },
  lagging: { label: "Lagging", variant: "gold" },
  down: { label: "Down", variant: "destructive" },
};

export function ProductTile({
  name,
  result,
  now,
}: {
  name: string;
  result: MetricsResult;
  now: number;
}) {
  if (!result.ok) {
    const label =
      result.reason === "auth"
        ? "Auth error"
        : result.reason === "bad_shape"
          ? "Bad response"
          : "Unavailable";
    return (
      <div className="rounded-xl border border-dashed bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{name}</h3>
          <Badge variant="destructive">{label}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          No live metrics right now.
        </p>
      </div>
    );
  }

  const d = result.data;
  const badge = HEALTH[classifyHealth(result, now)];
  const ordersTrend = computeTrend(d.orders_7d, d.orders_prev_7d);
  const chips: [string, string][] = [
    ["GMV (30d)", money(d.gmv_cents_30d)],
    ["Signups (7d)", String(d.signups_7d)],
    ["Pro vendors", String(d.pro_vendors)],
  ];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{name}</h3>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {d.pending_upgrade_requests > 0 && (
        <Badge variant="gold" className="mt-2">
          {d.pending_upgrade_requests} upgrade request
          {d.pending_upgrade_requests === 1 ? "" : "s"}
        </Badge>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <DollarSign className="size-3.5" />
            Revenue (30d)
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            {money(d.revenue_cents_30d)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" />
            Active vendors
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            {d.active_vendors}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
          <span className="text-muted-foreground">Orders (7d)</span>
          <span className="font-medium tabular-nums">{d.orders_7d}</span>
          {ordersTrend.pct !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                ordersTrend.direction === "up" && "text-primary",
                ordersTrend.direction === "down" && "text-destructive",
                ordersTrend.direction === "flat" && "text-muted-foreground",
              )}
            >
              {ordersTrend.direction === "up" && <ArrowUp className="size-3" />}
              {ordersTrend.direction === "down" && (
                <ArrowDown className="size-3" />
              )}
              {ordersTrend.pct}%
            </span>
          )}
        </span>
        {chips.map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
          >
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium tabular-nums">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
