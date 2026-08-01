import Link from "next/link";
import { requireActiveVendor } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every gated /dashboard route once here; the page re-derives links cheaply.
  const { user, isTeam } = await requireActiveVendor();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-5 py-3.5 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="merqo dashboard home"
            className="shrink-0 transition-opacity hover:opacity-80"
          >
            <Wordmark className="text-3xl" />
          </Link>
          <AccountMenu
            email={user.email}
            avatarUrl={getAvatarUrl(user)}
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
