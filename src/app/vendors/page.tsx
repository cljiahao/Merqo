import { requireMerqoTeam } from "@/lib/team";
import { listVendorGrants, listProducts } from "@/lib/admin";
import { GrantForm } from "./grant-form";
import { RevokeButton } from "./revoke-button";
import { DashHeader } from "@/components/dashboard/dash-header";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

export default async function VendorsPage() {
  const { user } = await requireMerqoTeam();
  const [grants, products] = await Promise.all([
    listVendorGrants(),
    listProducts(),
  ]);

  return (
    <>
      <DashHeader email={user.email} />
      <main className="mx-auto max-w-4xl space-y-10 px-5 py-8">
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
            Give a vendor active access — even if they never joined the
            waitlist.
          </p>
          <GrantForm products={products} />
        </section>

        <section>
          <h2 className="font-display text-lg font-bold">All vendors</h2>
          {grants.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No vendor links yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {grants.map((v) => (
                <li
                  key={v.email}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="font-medium">{v.email}</div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {v.kits.map((k) => (
                      <span
                        key={k.slug}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pl-2.5 pr-1 text-xs"
                      >
                        <span className="font-mono">{k.slug}</span>
                        <Badge
                          variant={k.status === "active" ? "success" : "muted"}
                          className="border-0 px-1.5 py-0"
                        >
                          {k.status}
                        </Badge>
                        <RevokeButton email={v.email} slug={k.slug} />
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
