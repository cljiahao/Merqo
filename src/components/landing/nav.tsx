import Link from "next/link";
import { LandingNav } from "@merqo/ui";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

export function Nav({ authed = false }: { authed?: boolean }) {
  return (
    <LandingNav
      wordmark={
        <Link
          href="/"
          className="rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark className="text-3xl" />
          <span className="sr-only">Merqo home</span>
        </Link>
      }
      end={
        <>
          <Link
            href="#kits"
            className="rounded-sm px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Kits
          </Link>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <a href="#faq">FAQ</a>
          </Button>
          <Button asChild size="sm">
            <Link href={authed ? "/admin" : "/login"}>
              {authed ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </>
      }
    />
  );
}
