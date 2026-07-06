import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { listVendorGrants, listProducts, listTeamMembers } from "@/lib/admin";
import {
  grantKitAction,
  revokeKitAction,
  removeTeamMemberAction,
} from "./actions";
import { AddTeamForm } from "./add-team-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const revalidate = 0;

export default async function AdminPage() {
  const { user } = await requireMerqoTeam();
  const [grants, products, team] = await Promise.all([
    listVendorGrants(),
    listProducts(),
    listTeamMembers(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Merqo — Admin</h1>
        <Link href="/team" className="text-sm text-primary hover:underline">
          Team overview →
        </Link>
      </header>

      {/* Grant a kit to a vendor */}
      <section className="space-y-3">
        <h2 className="font-semibold">Grant a kit</h2>
        <p className="text-sm text-muted-foreground">
          Give a vendor active access to a kit. Creates their access even if
          they never joined the waitlist.
        </p>
        <form
          action={grantKitAction}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="grant-email" className="sr-only">
            Vendor email
          </label>
          <Input
            id="grant-email"
            name="email"
            type="email"
            required
            placeholder="vendor@business.sg"
            className="sm:max-w-xs"
          />
          <label htmlFor="grant-slug" className="sr-only">
            Kit
          </label>
          <select
            id="grant-slug"
            name="slug"
            required
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <Button type="submit">Grant access</Button>
        </form>
      </section>

      {/* Vendors + their kits */}
      <section className="space-y-3">
        <h2 className="font-semibold">Vendors</h2>
        {grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vendor links yet.</p>
        ) : (
          <ul className="space-y-2">
            {grants.map((v) => (
              <li key={v.email} className="rounded-lg border p-4">
                <div className="font-medium">{v.email}</div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {v.kits.map((k) => (
                    <li
                      key={k.slug}
                      className="flex items-center gap-2 rounded-full border py-1 pr-1 pl-3 text-sm"
                    >
                      <span className="font-mono text-xs">{k.slug}</span>
                      <span
                        className={
                          k.status === "active"
                            ? "text-xs font-medium text-primary"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {k.status}
                      </span>
                      <form action={revokeKitAction}>
                        <input type="hidden" name="email" value={v.email} />
                        <input type="hidden" name="slug" value={k.slug} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="xs"
                          className="text-destructive hover:text-destructive"
                        >
                          Revoke
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Merqo team */}
      <section className="space-y-3">
        <h2 className="font-semibold">Merqo team</h2>
        <p className="text-sm text-muted-foreground">
          Team members can see the overview and this admin page. Add by email —
          the person must have signed in once.
        </p>
        <AddTeamForm />
        <ul className="mt-2 space-y-2">
          {team.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm">
                {m.email ?? m.user_id}
                {m.user_id === user.id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </span>
              {m.user_id !== user.id && (
                <form action={removeTeamMemberAction}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
