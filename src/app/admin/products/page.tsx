import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { ProductHealthCard } from "./product-health-card";

export const revalidate = 0;

export default async function AdminProductsPage() {
  await requireMerqoTeam();
  const products = await listLiveProducts();
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );

  // Reading the wall clock in an async server component is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Products
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Per-kit performance and health.
      </p>

      {products.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No live products registered yet.
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p, i) => (
            <ProductHealthCard
              key={p.slug}
              name={p.name}
              result={results[i]}
              now={now}
            />
          ))}
        </section>
      )}
    </main>
  );
}
