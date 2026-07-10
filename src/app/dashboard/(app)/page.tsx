import Link from "next/link";
import {
  requireActiveVendor,
  tilesForLinks,
  addableKits,
  comingKits,
} from "@/lib/vendor";
import { KITS } from "@/lib/kits";
import { VendorKitCard } from "./vendor-kit-card";
import { KitDiscoveryCard } from "@/components/dashboard/kit-discovery-card";
import { JoinWaitlistButton } from "@/components/dashboard/join-waitlist-button";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);
  const readyToAdd = addableKits(links);
  const comingSoon = comingKits(links);
  const planned = KITS.filter((k) => k.status === "planned");

  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Your kits
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((t) => (
          <VendorKitCard key={t.slug} tile={t} />
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
