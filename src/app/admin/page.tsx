import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { listLiveProducts } from "@/lib/products";
import { listVendorGrants } from "@/lib/admin";
import { fetchProductMetrics } from "@/lib/metrics-client";
import { summarizeOverview } from "@/lib/overview";
import { classifyHealth } from "@/lib/health";
import { onboardingFunnel } from "@/lib/funnel";
import { money } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingFunnelView } from "./onboarding-funnel";
import { ProductCard } from "./product-card";

export const revalidate = 0;

export default async function AdminOverviewPage() {
  await requireMerqoTeam();
  const [products, grants] = await Promise.all([
    listLiveProducts(),
    listVendorGrants(),
  ]);
  const results = await Promise.all(
    products.map((p) => fetchProductMetrics(p)),
  );
  const totals = summarizeOverview(results);

  // Reading the wall clock in an async server component is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const health = results.map((r) => classifyHealth(r, now));
  const lagging = health.filter((h) => h === "lagging").length;

  const links = grants.flatMap((g) => g.kits);
  const funnel = onboardingFunnel(links, totals.active_vendors);
  const waitlist = grants
    .flatMap((g) => g.kits.map((k) => ({ email: g.email, kit: k })))
    .filter((x) => x.kit.status === "waitlist");
  const attention = waitlist.length + totals.pending_upgrade_requests;

  const allDown = products.length > 0 && totals.products_reporting === 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.products_reporting} reporting
          {lagging > 0 ? ` · ${lagging} lagging` : ""}
          {totals.products_down > 0 ? ` · ${totals.products_down} down` : ""}
        </p>
      </div>

      {attention > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs attention · {attention}
          </h2>
          {waitlist.map((w) => (
            <div
              key={`${w.email}-${w.kit.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${encodeURIComponent(w.email)}`}
                  className="truncate font-medium hover:underline"
                >
                  {w.email}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  waitlisted for {w.kit.slug}
                </p>
              </div>
            </div>
          ))}
          {totals.pending_upgrade_requests > 0 && (
            <p className="text-sm text-muted-foreground">
              {totals.pending_upgrade_requests} upgrade request
              {totals.pending_upgrade_requests === 1 ? "" : "s"} across kits.
            </p>
          )}
        </section>
      )}

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
          <StatCard label="GMV (30d)" value={money(totals.gmv_cents_30d)} />
          <StatCard
            label="Active vendors"
            value={String(totals.active_vendors)}
          />
          <StatCard label="Orders (7d)" value={String(totals.orders_7d)} />
        </section>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <OnboardingFunnelView counts={funnel} />
      </div>

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
  );
}
