"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { User, LifeBuoy, MessageSquarePlus, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FeedbackForm } from "@/components/feedback-form";
import { SupportForm } from "@/components/support-form";
import { signOutAction } from "@/app/actions/auth";

/** Single-letter avatar fallback derived from an email's first character —
 *  Merqo has no stored display name (vendors and team members are identified
 *  by email/user_id only) to draw real initials from. */
export function initials(email: string | null | undefined): string {
  const first = email?.trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}

/** Shared account-menu trigger for /dashboard and /admin headers — an image
 *  avatar (or initials fallback) that opens a dropdown with the signed-in
 *  email, a Profile link, Get help and Feedback (each opening a Sheet form),
 *  an optional switch link for dual-role accounts, and Sign out. Matches the
 *  qkit/loopkit/paykit avatar-menu pattern: a single "Get help" item opens
 *  the support form rather than deep-linking to another kit's dashboard. */
export function AccountMenu({
  email,
  avatarUrl,
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  switchTo?: { href: string; label: string };
}) {
  const [, startTransition] = useTransition();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-tour="account-menu"
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
            <Link href="/profile">
              <User /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setSupportOpen(true)}
          >
            <LifeBuoy /> Get help
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setFeedbackOpen(true)}
          >
            <MessageSquarePlus /> Feedback
          </DropdownMenuItem>
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
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">Feedback</SheetTitle>
            <SheetDescription>
              How&apos;s Merqo working for you? Tell us what&apos;s working,
              what&apos;s missing, or what&apos;s broken.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FeedbackForm />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">Get help</SheetTitle>
            <SheetDescription>
              Something not working, or need help with your Merqo account? Tell
              us and we&apos;ll follow up.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <SupportForm />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
