import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerqoTeam } from "@/lib/team";
import { getVendorGrant, listProducts } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { GrantForm } from "../grant-form";
import { RevokeButton } from "../revoke-button";

export const revalidate = 0;

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireMerqoTeam();
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);
  const [grant, products] = await Promise.all([
    getVendorGrant(email),
    listProducts(),
  ]);
  if (!grant) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All vendors
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {grant.email}
        </h1>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold">Kits</h2>
        {grant.kits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No kits yet — grant one below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {grant.kits.map((k) => (
              <li
                key={k.slug}
                className="flex items-center justify-between rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{k.slug}</span>
                  <Badge
                    variant={k.status === "active" ? "success" : "muted"}
                    className="border-0 px-1.5 py-0"
                  >
                    {k.status}
                  </Badge>
                </span>
                <RevokeButton email={grant.email} slug={k.slug} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold">Grant a kit</h2>
        <GrantForm products={products} defaultEmail={grant.email} />
      </section>
    </main>
  );
}
