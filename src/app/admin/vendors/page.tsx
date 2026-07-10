import { requireMerqoTeam } from "@/lib/team";
import { listVendorGrants, listProducts } from "@/lib/admin";
import { GrantForm } from "./grant-form";
import { VendorList } from "./vendor-list";

export const revalidate = 0;

export default async function VendorsPage() {
  await requireMerqoTeam();
  const [grants, products] = await Promise.all([
    listVendorGrants(),
    listProducts(),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-5 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Vendors
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant kit access and see who owns what.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold">Grant a kit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give a vendor active access — even if they never joined the waitlist.
        </p>
        <GrantForm products={products} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">All vendors</h2>
        <VendorList grants={grants} products={products} />
      </section>
    </main>
  );
}
