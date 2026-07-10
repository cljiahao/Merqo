"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/auth";

/** Single-letter avatar fallback derived from an email's first character —
 *  Merqo has no stored display name (vendors and team members are identified
 *  by email/user_id only) to draw real initials from. */
export function initials(email: string | null | undefined): string {
  const first = email?.trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}

/** Shared account-menu trigger for /dashboard and /admin headers — an
 *  initials avatar that opens a dropdown with the signed-in email, an
 *  optional switch link for dual-role accounts, and Sign out. Matches
 *  qkit's DashboardNav account-area shape; scoped to just account info +
 *  navigation since Merqo has no Profile/Settings/Help pages. */
export function AccountMenu({
  email,
  switchTo,
}: {
  email?: string | null;
  switchTo?: { href: string; label: string };
}) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25 ring-inset"
          >
            {initials(email)}
          </span>
          {email && (
            <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
              {email}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {switchTo && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={switchTo.href}>{switchTo.label}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onSelect={() => startTransition(() => signOutAction())}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
