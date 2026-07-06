"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEAM_LINKS = [
  { href: "/team", label: "Overview" },
  { href: "/products", label: "Products" },
  { href: "/admin", label: "Admin" },
];
const VENDOR_LINKS = [{ href: "/products", label: "Products" }];

export function DashHeader({ isTeam = false }: { isTeam?: boolean }) {
  const path = usePathname();
  const links = isTeam ? TEAM_LINKS : VENDOR_LINKS;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-5">
          <Link
            href={isTeam ? "/team" : "/products"}
            className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => {
              const active = path === l.href || path.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
