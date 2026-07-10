"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

/** Shared account-menu trigger for /dashboard and /admin headers — an image
 *  avatar (or initials fallback) that opens a dropdown with the signed-in email,
 *  a Profile link, a Get Help submenu (listing the vendor's active kits' support
 *  links plus "Contact Merqo"), an optional switch link for dual-role accounts,
 *  and Sign out. */
export function AccountMenu({
  email,
  avatarUrl,
  activeKits = [],
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  activeKits?: { slug: string; name: string; href: string }[];
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
          {avatarUrl ? (
            // size-8 avatar; next/image's optimization overhead isn't worth
            // it here, and Merqo has no next.config.ts remote-pattern setup
            // for external avatar hosts (Google) today.
            // eslint-disable-next-line @next/next/no-img-element -- fixed
            <img
              src={avatarUrl}
              alt="Profile picture"
              className="size-8 shrink-0 rounded-md object-cover ring-1 ring-primary/25 ring-inset"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25 ring-inset"
            >
              {initials(email)}
            </span>
          )}
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
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            Get help
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {activeKits.map((k) => (
              <DropdownMenuItem key={k.slug} asChild className="cursor-pointer">
                <a
                  href={`${k.href}/dashboard`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {k.name} support
                </a>
              </DropdownMenuItem>
            ))}
            {activeKits.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem asChild className="cursor-pointer">
              <a href="mailto:hello@merqo.sg?subject=Merqo%20account%20help">
                Contact Merqo
              </a>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {switchTo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={switchTo.href}>{switchTo.label}</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
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
