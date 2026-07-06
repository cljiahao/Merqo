import { KIT_NODES } from "@/lib/ecosystem";
import { cn } from "@/lib/utils";

type FlowProps = {
  stacked: ReadonlySet<string>;
  highlight?: string | null;
  onHighlight: (slug: string | null) => void;
};

// Flow order: inputs → the queue → outputs. Only stacked kits appear.
const FLOW = ["shopkit", "slotkit", "qkit", "tapkit", "loopkit"];
const HANDOFF: Record<string, string> = {
  shopkit: "order",
  slotkit: "booking",
  qkit: "queued",
  tapkit: "paid",
  loopkit: "points",
};
const nodeBy = (s: string) => KIT_NODES.find((n) => n.slug === s)!;

function Pill({
  label,
  slug,
  tone,
}: {
  label: string;
  slug?: string;
  tone: "edge" | "kit-live" | "kit";
}) {
  return (
    <div
      className={cn(
        "flex min-w-[92px] flex-col items-center rounded-xl border px-4 py-3 text-center shadow-sm",
        tone === "kit-live"
          ? "border-gold bg-primary text-primary-foreground"
          : tone === "kit"
            ? "bg-card"
            : "border-dashed bg-secondary/40",
      )}
    >
      <span className="font-display text-sm font-bold">{label}</span>
      {slug && (
        <span
          className={cn(
            "font-mono text-[10px]",
            tone === "kit-live"
              ? "text-primary-foreground/80"
              : "text-muted-foreground",
          )}
        >
          {slug}
        </span>
      )}
    </div>
  );
}

function Hop({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span className="font-mono text-[10px] text-muted-foreground">
        {label}
      </span>
      <span aria-hidden className="text-muted-foreground">
        →
      </span>
    </div>
  );
}

export function FlowJourney({ stacked, onHighlight }: FlowProps) {
  const kits = FLOW.filter((s) => stacked.has(s));
  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative flex min-w-max items-center py-8">
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-border">
          <span className="flow-token absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary" />
        </div>

        <Pill label="Customer" tone="edge" />
        {kits.map((s) => {
          const n = nodeBy(s);
          return (
            <div
              key={s}
              className="relative flex items-center"
              onMouseEnter={() => onHighlight(s)}
              onMouseLeave={() => onHighlight(null)}
            >
              <Hop label={HANDOFF[s]} />
              <Pill
                label={n.short}
                slug={s}
                tone={n.status === "live" ? "kit-live" : "kit"}
              />
            </div>
          );
        })}
        <Hop label="done" />
        <Pill label="Order done" tone="edge" />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Watch an order flow through your stack — each kit does its part.
      </p>
    </div>
  );
}
