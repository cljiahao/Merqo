import { ArrowUpRight } from "lucide-react";
import { requireVendor, resolveVendorCatalog } from "@/lib/vendor";
import { DashHeader } from "@/components/dashboard/dash-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { joinWaitlistAction } from "./actions";

export const revalidate = 0;

export default async function VendorProductsPage() {
  const { email } = await requireVendor();
  const catalog = await resolveVendorCatalog(email);
  const owned = catalog.filter((c) => c.owned === "active");
  const rest = catalog.filter((c) => c.owned !== "active");

  return (
    <>
      <DashHeader />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Your products
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The Merqo kits on your account.
        </p>

        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active
        </h2>
        {owned.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No active products yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {owned.map((c) => (
              <li
                key={c.slug}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="success">Active</Badge>
                </div>
                {c.app_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={c.app_url}>
                      Open
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Add more
        </h2>
        <ul className="mt-3 space-y-2">
          {rest.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-medium">{c.name}</span>
                {c.status === "coming_soon" && (
                  <Badge variant="muted">Coming soon</Badge>
                )}
              </div>
              {c.owned === "waitlist" ? (
                <Badge variant="secondary">On waitlist</Badge>
              ) : (
                <form action={joinWaitlistAction}>
                  <input type="hidden" name="product_slug" value={c.slug} />
                  <Button type="submit" size="sm">
                    Join waitlist
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
