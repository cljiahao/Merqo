import type { MetricsResult } from "@/lib/metrics-client";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export function ProductCard({ name, result }: { name: string; result: MetricsResult }) {
  if (!result.ok) {
    const label =
      result.reason === "auth"
        ? "Auth error"
        : result.reason === "bad_shape"
          ? "Bad response"
          : "Unavailable";
    return (
      <div className="rounded-lg border border-dashed p-4 opacity-70">
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-red-600">{label}</p>
      </div>
    );
  }
  const d = result.data;
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{name}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>Revenue (30d)</dt>
        <dd>{money(d.revenue_cents_30d)}</dd>
        <dt>GMV (30d)</dt>
        <dd>{money(d.gmv_cents_30d)}</dd>
        <dt>Active vendors</dt>
        <dd>{d.active_vendors}</dd>
        <dt>Orders (7d)</dt>
        <dd>{d.orders_7d}</dd>
        <dt>Signups (7d)</dt>
        <dd>{d.signups_7d}</dd>
        <dt>Pro vendors</dt>
        <dd>{d.pro_vendors}</dd>
        <dt>Upgrade requests</dt>
        <dd>{d.pending_upgrade_requests}</dd>
      </dl>
    </div>
  );
}
