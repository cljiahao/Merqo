import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { money } from "@/lib/format";
import { DashHeader } from "@/components/dashboard/dash-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProductCard } from "./product-card";

export const revalidate = 0;

export default async function DashboardPage() {
  const { user } = await requireMerqoTeam();
  const products = await listLiveProducts();
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );
  const totals = summarizeOverview(results);
  const allDown = products.length > 0 && totals.products_reporting === 0;

  return (
    <>
      <DashHeader email={user.email} />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.products_reporting} reporting
          {totals.products_down > 0
            ? ` · ${totals.products_down} unavailable`
            : ""}
        </p>

        {allDown ? (
          <div
            role="status"
            className="mt-6 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground"
          >
            Metrics unavailable — no product is reporting right now.
          </div>
        ) : (
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Revenue (all)"
              value={money(totals.revenue_cents_all)}
              accent
            />
            <StatCard
              label="Active vendors"
              value={String(totals.active_vendors)}
            />
            <StatCard label="Orders (7d)" value={String(totals.orders_7d)} />
            <StatCard
              label="Upgrade requests"
              value={String(totals.pending_upgrade_requests)}
            />
          </section>
        )}

        <h2 className="mt-10 font-display text-lg font-bold tracking-tight">
          Products
        </h2>
        {products.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="text-sm font-medium">No products registered yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kits appear here once they&apos;re added to the registry.
            </p>
          </div>
        ) : (
          <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.map((p, i) => (
              <ProductCard key={p.slug} name={p.name} result={results[i]} />
            ))}
          </section>
        )}
      </main>
    </>
  );
}
