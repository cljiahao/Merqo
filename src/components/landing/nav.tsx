import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QKIT_URL } from "@/lib/kits";
import { Wordmark } from "./wordmark";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark />
          <span className="sr-only">Merqo home</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="#kits"
            className="rounded-sm px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Kits
          </Link>
          <Button asChild size="sm">
            <a href={QKIT_URL}>Open qkit</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
