import Link from "next/link";
import { Footer as SharedFooter } from "@merqo/ui";
import { Wordmark } from "./wordmark";

/**
 * Thin adapter over `@merqo/ui`'s shared `Footer`. merqo is the hub rather
 * than a kit, so it overrides the copyright line — the shared default ends
 * in "a Merqo kit", which would be wrong here. That `copyright` prop was
 * added in v0.31.0 so this file could stop being a second copy of the same
 * layout.
 */
export function Footer() {
  return (
    <SharedFooter
      kitName="merqo"
      tagline={"Simple tools for Singapore’s small sellers."}
      copyright="© 2026 Merqo"
      signInLabel="Sign in →"
      wordmark={
        <Link
          href="/"
          aria-label="Merqo home"
          className="transition-opacity hover:opacity-80"
        >
          <Wordmark className="text-xl" />
        </Link>
      }
    />
  );
}
