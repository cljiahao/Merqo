import Link from "next/link";
import { requireActiveVendor, tilesForLinks, addableKits } from "@/lib/vendor";
import { VendorKitCard } from "./vendor-kit-card";

export const revalidate = 0;

export default async function DashboardPage() {
  const { links } = await requireActiveVendor();
  const { active, pending } = tilesForLinks(links);
  const addable = addableKits(links);

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

      {addable.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a kit
          </h2>
          <ul className="mt-3 space-y-2">
            {addable.map((t) => (
              <li
                key={t.slug}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {t.tagline}
                  </span>
                </div>
                {t.href && (
                  <a
                    href={`${t.href}/login`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-medium text-foreground hover:underline"
                  >
                    Add {t.name}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
