import Link from "next/link";
import { QKIT_URL } from "@/lib/kits";
import { Wordmark } from "./wordmark";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Wordmark className="text-xl" />
          <p className="text-xs text-muted-foreground">
            Simple tools for Singapore&rsquo;s small sellers.
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href={QKIT_URL} className="hover:text-foreground">
            qkit
          </a>
          <Link href="#kits" className="hover:text-foreground">
            Kits
          </Link>
          <span className="text-xs">© 2026 Merqo</span>
        </div>
      </div>
    </footer>
  );
}
