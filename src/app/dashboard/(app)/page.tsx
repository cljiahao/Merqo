import Link from "next/link";
import {
  requireActiveVendor,
  tilesForLinks,
  addableKits,
  provisionableKits,
  comingKits,
} from "@/lib/vendor";
import { listLiveProducts } from "@/lib/products";
import { syncVendorKits } from "@/lib/vendor-sync";
import { KITS, LIVE_KITS } from "@/lib/kits";
import { computeVendorSavings } from "@/lib/savings";
import { SavingsSummary } from "./savings-summary";
import {
  fetchVendorMetrics,
  type VendorMetricsResult,
} from "@/lib/vendor-metrics-client";
import { VendorKitCard } from "./vendor-kit-card";
import { KitDiscoveryCard } from "@/components/dashboard/kit-discovery-card";
import { JoinWaitlistButton } from "@/components/dashboard/join-waitlist-button";
import { ActivateKitsButton } from "@/components/dashboard/activate-kits-button";

export const revalidate = 0;

export default async function DashboardPage() {
  const { user, links: initialLinks } = await requireActiveVendor();
  // Unlike /dashboard/pending, this page has no "Check again" affordance —
  // without re-syncing here, a vendor who signs up directly on another
  // kit's site (the "Add {kit}" link just opens that kit's own login page)
  // never sees it reflected without a full logout/login, since sync
  // otherwise only runs from /post-login.
  const links = user.email ? await syncVendorKits(user.email) : initialLinks;
  const { active, pending, needsSetup } = tilesForLinks(links);
  const savings = computeVendorSavings(links);
  const savingsBySlug = new Map(savings.perKit.map((s) => [s.slug, s]));
  // Best-effort: a products-registry read failure degrades to "nothing is
  // provisionable" rather than crashing the whole dashboard — matches
  // syncVendorKits' graceful-degradation philosophy on this same page.
  let liveProducts: Awaited<ReturnType<typeof listLiveProducts>> = [];
  try {
    liveProducts = await listLiveProducts();
  } catch (err) {
    console.error(
      "listLiveProducts failed; treating no kits as provisionable",
      err,
    );
  }
  // "Ready to add" shows a card for every kit.ts-live kit the vendor doesn't
  // already have (addableKits) — paykit included, even though it can't yet be
  // one-click-activated. provisionableSlugs narrows just which of those cards
  // get the ActivateKitsButton vs. the old external "log in on that kit" link.
  const readyToAdd = addableKits(links);
  const provisionableSlugs = new Set(
    provisionableKits(
      links,
      new Set(
        liveProducts.filter((p) => p.provision_secret).map((p) => p.slug),
      ),
    ).map((k) => k.slug),
  );
  const comingSoon = comingKits(links);
  const planned = KITS.filter((k) => k.status === "planned");

  // Reading the wall clock in an async server component is intentional here,
  // same as admin's overview page — a stable "now" for every freshness label
  // rendered below.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const registryBySlug = new Map(liveProducts.map((r) => [r.slug, r]));
  const email = user.email;
  const metricsByTile = email
    ? new Map<string, VendorMetricsResult>(
        await Promise.all(
          active.map(async (t) => {
            const row = registryBySlug.get(t.slug) ?? {
              slug: t.slug,
              app_url: null,
              metrics_secret: null,
            };
            return [t.slug, await fetchVendorMetrics(row, email)] as const;
          }),
        ),
      )
    : new Map<string, VendorMetricsResult>();

  return (
    <>
      <div data-tour="dashboard-welcome">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Your kits
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {active.length} of {LIVE_KITS.length} kits connected — everything you
          run through Merqo, in one place.
        </p>
      </div>

      {(pending.length > 0 || needsSetup.length > 0) && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs your attention · {pending.length + needsSetup.length}
          </h2>
          {pending.map((t) => (
            <div
              key={t.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/50 bg-card px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{t.name}</span>
                <p className="text-xs text-muted-foreground">
                  Requested — we&apos;ll email you when it opens.
                </p>
              </div>
            </div>
          ))}
          {needsSetup.map((t) => (
            <div
              key={t.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/50 bg-card px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{t.name}</span>
                <p className="text-xs text-muted-foreground">
                  One step left to activate.
                </p>
              </div>
              {t.href && (
                <a
                  href={`${t.href}/dashboard/config`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground hover:underline"
                >
                  Finish setup
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      <SavingsSummary totals={savings} />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard
            key={t.slug}
            tile={t}
            savings={savingsBySlug.get(t.slug)}
            metrics={metricsByTile.get(t.slug) ?? { ok: false, slug: t.slug }}
            now={now}
          />
        ))}
      </section>

      <section className="mt-10 border-t pt-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explore more kits
        </p>
        <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
          Complete your toolkit
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each kit stands on its own, but they&apos;re built to work together.
        </p>

        {readyToAdd.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ready to add
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {readyToAdd.map((kit) => (
                <KitDiscoveryCard
                  key={kit.slug}
                  kit={kit}
                  cta={
                    provisionableSlugs.has(kit.slug) ? (
                      <ActivateKitsButton
                        slugs={[kit.slug]}
                        label={`Add ${kit.name}`}
                        variant="secondary"
                        size="sm"
                      />
                    ) : (
                      kit.href && (
                        <a
                          href={`${kit.href}/login`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          Add {kit.name}
                        </a>
                      )
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {comingSoon.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Coming soon
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {comingSoon.map((kit) => (
                <KitDiscoveryCard
                  key={kit.slug}
                  kit={kit}
                  cta={
                    <JoinWaitlistButton slug={kit.slug} kitName={kit.name} />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {planned.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Planned
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {planned.map((kit) => (
                <KitDiscoveryCard key={kit.slug} kit={kit} />
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        More kits coming —{" "}
        <Link
          href="/#kits"
          className="font-medium text-foreground hover:underline"
        >
          see the family
        </Link>
        .
      </p>
    </>
  );
}
