import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Kit } from "@/lib/kits";
import { cn } from "@/lib/utils";
import { WaitlistForm } from "./waitlist-form";

/** Status stamp — a small monospace "kitchen ticket" mark. Gold + filled for
 *  live (the value signal); quiet outline for coming. */
function Stamp({ status }: { status: "live" | "coming" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest",
        status === "live"
          ? "bg-gold text-gold-foreground"
          : "border text-muted-foreground",
      )}
    >
      {status === "live" ? "Live" : "Coming soon"}
    </span>
  );
}

export function KitCard({ kit }: { kit: Kit }) {
  // Planned kits render as an unfilled tray slot — the signature move: the empty
  // outline is the roadmap made physical ("room to grow"), not a dead card.
  if (kit.status === "planned") {
    return (
      <div className="flex h-full flex-col gap-2 rounded-xl border border-dashed p-6 text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">{kit.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest">
            Planned
          </span>
        </div>
        <p className="text-sm">{kit.tagline}</p>
      </div>
    );
  }

  const live = kit.status === "live";
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm",
        live && "ring-1 ring-primary/25",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold">{kit.name}</span>
        <Stamp status={kit.status} />
      </div>
      <p className="text-sm text-muted-foreground">{kit.tagline}</p>
      <div className="mt-auto pt-1">
        {live ? (
          <Link
            href={kit.href!}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Open {kit.name}
            <ArrowUpRight className="size-4" />
          </Link>
        ) : (
          <WaitlistForm slug={kit.slug} />
        )}
      </div>
    </div>
  );
}
