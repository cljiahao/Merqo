import Link from "next/link";
import { requireMerqoTeam } from "@/lib/team";
import { hasActiveVendorAccess } from "@/lib/vendor";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route once here; child pages re-derive the user cheaply.
  const { user } = await requireMerqoTeam();
  const canSwitch = user.email
    ? await hasActiveVendorAccess(user.email)
    : false;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Wordmark className="text-2xl" />
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </span>
          </Link>
          <AccountMenu
            email={user.email}
            switchTo={
              canSwitch
                ? { href: "/dashboard", label: "View vendor dashboard" }
                : undefined
            }
          />
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
