"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/vendors", label: "Vendors" },
  { href: "/team", label: "Team" },
];

function isActive(path: string, href: string): boolean {
  return path === href || path.startsWith(href + "/");
}

export function DashHeader({ email }: { email?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2 sm:gap-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1.5 sm:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Link
            href="/dashboard"
            className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isActive(path, l.href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default sm:hidden"
          />
          <div className="absolute inset-x-0 top-full z-40 border-b bg-background/95 px-5 py-3 shadow-sm backdrop-blur sm:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
              {email && (
                <span className="truncate px-3 py-1 text-xs text-muted-foreground">
                  {email}
                </span>
              )}
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium",
                    isActive(path, l.href)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
