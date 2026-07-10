import { requireActiveVendor, activeKitSupportLinks } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every gated /dashboard route once here; the page re-derives links cheaply.
  const { user, isTeam, links } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Wordmark className="text-2xl" />
          <AccountMenu
            email={user.email}
            avatarUrl={getAvatarUrl(user)}
            activeKits={activeKitSupportLinks(links)}
            switchTo={
              isTeam ? { href: "/admin", label: "Go to admin" } : undefined
            }
          />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
