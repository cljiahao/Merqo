import { Check, Plus } from "lucide-react";
import { KITS, WAITLISTABLE_SLUGS, type Kit } from "@/lib/kits";
import { HUB_SLUG } from "@/lib/ecosystem";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { WaitlistForm } from "../waitlist-form";

const GROUPS: { status: Kit["status"]; label: string }[] = [
  { status: "live", label: "Live now" },
  { status: "coming", label: "Coming soon" },
  { status: "planned", label: "Planned" },
];

export function ModuleList({
  stacked,
  onToggle,
  onHighlight,
}: {
  stacked: ReadonlySet<string>;
  onToggle: (slug: string) => void;
  onHighlight: (slug: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const kits = KITS.filter((k) => k.status === g.status);
        if (!kits.length) return null;
        return (
          <div key={g.status}>
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {g.label}
            </h3>
            <ul className="mt-2 space-y-2">
              {kits.map((k) => {
                const on = stacked.has(k.slug);
                const isHub = k.slug === HUB_SLUG;
                const waitlistable = WAITLISTABLE_SLUGS.includes(k.slug);
                return (
                  <li
                    key={k.slug}
                    onMouseEnter={() => onHighlight(k.slug)}
                    onMouseLeave={() => onHighlight(null)}
                    className={cn(
                      "rounded-xl border bg-card p-3 shadow-sm transition-colors",
                      on && "border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={isHub}
                        onClick={() => onToggle(k.slug)}
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-100",
                          on
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "hover:bg-accent",
                        )}
                      >
                        {on ? (
                          <Check className="size-4" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        <span className="sr-only">
                          {isHub
                            ? `${k.name} is always in your stack`
                            : on
                              ? `Remove ${k.name} from the stack`
                              : `Add ${k.name} to the stack`}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold">
                            {k.name}
                          </span>
                          {isHub && (
                            <Badge
                              variant="gold"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              LIVE
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {k.tagline}
                        </p>
                      </div>
                    </div>
                    {on && waitlistable && (
                      <div className="mt-2.5 pl-10">
                        <WaitlistForm slug={k.slug} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
