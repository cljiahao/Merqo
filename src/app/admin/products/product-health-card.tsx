import type { MetricsResult } from "@/lib/metrics-client";
import { classifyHealth, type HealthStatus } from "@/lib/health";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const HEALTH: Record<
  HealthStatus,
  { label: string; variant: "success" | "gold" | "destructive" }
> = {
  reporting: { label: "Reporting", variant: "success" },
  lagging: { label: "Lagging", variant: "gold" },
  down: { label: "Down", variant: "destructive" },
};

export function ProductHealthCard({
  name,
  result,
  now,
}: {
  name: string;
  result: MetricsResult;
  now: number;
}) {
  const status = classifyHealth(result, now);
  const badge = HEALTH[status];
  const lastSeen = result.ok
    ? result.data.generated_at.slice(0, 16).replace("T", " ")
    : "—";

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{name}</h3>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-0 text-sm">
        {(
          [
            ["Latency", `${result.durationMs} ms`],
            ["Last seen", lastSeen],
            [
              "Active vendors",
              result.ok ? String(result.data.active_vendors) : "—",
            ],
            [
              "Revenue (30d)",
              result.ok ? money(result.data.revenue_cents_30d) : "—",
            ],
            ["Orders (7d)", result.ok ? String(result.data.orders_7d) : "—"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between border-b border-border/60 py-2"
          >
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
