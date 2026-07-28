import Link from "next/link";
import {
  requireActiveVendor,
  tilesForLinks,
  provisionableKits,
  comingKits,
} from "@/lib/vendor";
import { listLiveProducts } from "@/lib/products";
import { syncVendorKits } from "@/lib/vendor-sync";
import { KITS } from "@/lib/kits";
import { computeVendorSavings } from "@/lib/savings";
import { SavingsSummary } from "./savings-summary";
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
  const { active, pending } = tilesForLinks(links);
  const savings = computeVendorSavings(links);
  const savingsBySlug = new Map(savings.perKit.map((s) => [s.slug, s]));
  const liveProducts = await listLiveProducts();
  const readyToAdd = provisionableKits(
    links,
    new Set(liveProducts.filter((p) => p.provision_secret).map((p) => p.slug)),
  );
  const comingSoon = comingKits(links);
  const planned = KITS.filter((k) => k.status === "planned");

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <SavingsSummary totals={savings} />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard
            key={t.slug}
            tile={t}
            savings={savingsBySlug.get(t.slug)}
          />
        ))}
      </section>

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Requested
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((t) => (
              <li
                key={t.slug}
                className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-muted-foreground">
                  — we&apos;ll email you when it opens.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Explore more kits
        </h2>

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
                    <ActivateKitsButton
                      slugs={[kit.slug]}
                      label={`Add ${kit.name}`}
                      variant="secondary"
                      size="sm"
                    />
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
