import { KITS } from "@/lib/kits";
import { cn } from "@/lib/utils";
import { KitCard } from "./kit-card";

/** The signature section: the kit family as a modular tray. Live kit dominates
 *  (full width), coming kits pair up, the planned kit is a wide empty slot. */
export function KitGrid() {
  return (
    <section id="kits" className="border-t bg-secondary/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          The kit family
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          A tray of tools. Add what you need, when you need it.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          One Merqo account, one login, one bill. Start with the queue today and
          switch on the rest as your business grows.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {KITS.map((kit) => (
            <div
              key={kit.slug}
              className={cn(kit.status !== "coming" && "sm:col-span-2")}
            >
              <KitCard kit={kit} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
