import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { money } from "@/lib/format";
import { ProductCard } from "./product-card";

export const revalidate = 0;

export default async function TeamPage() {
  await requireMerqoTeam();
  const products = await listLiveProducts();
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );
  const totals = summarizeOverview(results);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Merqo — Team Overview</h1>
      <p className="mt-1 text-sm text-gray-500">
        {totals.products_reporting} reporting
        {totals.products_down > 0
          ? `, ${totals.products_down} unavailable`
          : ""}
      </p>

      <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Revenue (all)" value={money(totals.revenue_cents_all)} />
        <Stat label="Active vendors" value={String(totals.active_vendors)} />
        <Stat label="Orders (7d)" value={String(totals.orders_7d)} />
        <Stat
          label="Upgrade requests"
          value={String(totals.pending_upgrade_requests)}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {products.map((p, i) => (
          <ProductCard key={p.slug} name={p.name} result={results[i]} />
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
