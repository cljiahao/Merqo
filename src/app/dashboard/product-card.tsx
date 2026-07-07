import type { MetricsResult } from "@/lib/metrics-client";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function ProductCard({
  name,
  result,
}: {
  name: string;
  result: MetricsResult;
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
  const rows: [string, string][] = [
    ["Revenue (30d)", money(d.revenue_cents_30d)],
    ["GMV (30d)", money(d.gmv_cents_30d)],
    ["Active vendors", String(d.active_vendors)],
    ["Orders (7d)", String(d.orders_7d)],
    ["Signups (7d)", String(d.signups_7d)],
    ["Pro vendors", String(d.pro_vendors)],
    ["Upgrade requests", String(d.pending_upgrade_requests)],
  ];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{name}</h3>
        <Badge variant="success">Live</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-0 text-sm">
        {rows.map(([k, v]) => (
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
