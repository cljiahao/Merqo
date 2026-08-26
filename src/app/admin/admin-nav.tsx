"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/landing/wordmark";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/activity", label: "Activity" },
];

/** Overview matches exactly; other tabs match by prefix. */
function isActive(path: string, href: string): boolean {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

/**
 * Admin console header: sticky logo/account row plus the section-tab nav.
 * Owns the mobile burger's open state — the burger (inline in the header
 * row, beside the wordmark) and the mobile tab panel it reveals both need
 * that state, so they live in one client component rather than threading it
 * through the (server) layout.
 */
export function AdminNav({
  email,
  avatarUrl,
  canSwitch,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  canSwitch: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-5 py-3.5 backdrop-blur-md print:hidden">
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-1.5 rounded-lg sm:hidden"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Wordmark className="text-3xl" />
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </span>
              </Link>
            </div>
            <AccountMenu
              email={email}
              avatarUrl={avatarUrl}
              switchTo={
                canSwitch
                  ? { href: "/dashboard", label: "View vendor dashboard" }
                  : undefined
              }
            />
          </div>

          {/* Mobile tab panel */}
          {open && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-30 cursor-default sm:hidden"
              />
              <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-background/95 px-5 py-3 shadow-sm backdrop-blur-md sm:hidden">
                <div className="flex flex-col gap-1">
                  {TABS.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-lg border-l-2 px-3 py-2.5 text-sm font-semibold",
                        isActive(path, t.href)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Desktop section tabs — sm and up */}
      <nav className="mx-auto hidden max-w-7xl gap-1 px-5 pt-4 sm:flex">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors",
              isActive(path, t.href)
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-secondary",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
