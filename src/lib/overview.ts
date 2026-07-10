import type { MetricsResult } from "@/lib/metrics-client";

export type OverviewTotals = {
  revenue_cents_all: number;
  revenue_cents_30d: number;
  gmv_cents_30d: number;
  active_vendors: number;
  orders_7d: number;
  orders_prev_7d: number;
  signups_7d: number;
  pro_vendors: number;
  total_vendors: number;
  pending_upgrade_requests: number;
  products_reporting: number;
  products_down: number;
};

export function summarizeOverview(results: MetricsResult[]): OverviewTotals {
  const t: OverviewTotals = {
    revenue_cents_all: 0,
    revenue_cents_30d: 0,
    gmv_cents_30d: 0,
    active_vendors: 0,
    orders_7d: 0,
    orders_prev_7d: 0,
    signups_7d: 0,
    pro_vendors: 0,
    total_vendors: 0,
    pending_upgrade_requests: 0,
    products_reporting: 0,
    products_down: 0,
  };
  for (const r of results) {
    if (!r.ok) {
      t.products_down += 1;
      continue;
    }
    t.products_reporting += 1;
    const d = r.data;
    t.revenue_cents_all += d.revenue_cents_all;
    t.revenue_cents_30d += d.revenue_cents_30d;
    t.gmv_cents_30d += d.gmv_cents_30d;
    t.active_vendors += d.active_vendors;
    t.orders_7d += d.orders_7d;
    t.orders_prev_7d += d.orders_prev_7d;
    t.signups_7d += d.signups_7d;
    t.pro_vendors += d.pro_vendors;
    t.total_vendors += d.total_vendors;
    t.pending_upgrade_requests += d.pending_upgrade_requests;
  }
  return t;
}
