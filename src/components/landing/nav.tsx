import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

export function Nav({ authed = false }: { authed?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-5 py-4 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark className="text-3xl" />
          <span className="sr-only">Merqo home</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
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
        </div>
      </nav>
    </header>
  );
}
