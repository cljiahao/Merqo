import { KIT_NODES, KIT_EDGES } from "@/lib/ecosystem";
import { cn } from "@/lib/utils";

// Bottom → top: qkit renders first if stacked, the rest follow in the same
// order as the landing graph (KIT_NODES) so both views stay in sync.
const STACK_ORDER = [
  "qkit",
  ...KIT_NODES.map((n) => n.slug).filter((s) => s !== "qkit"),
];

const nodeBy = (slug: string) => KIT_NODES.find((n) => n.slug === slug)!;

// A kit's relationship to the queue (its edge touching qkit), if it has one.
function queueLink(slug: string): string {
  const e = KIT_EDGES.find(
    (e) =>
      (e.from === slug && e.to === "qkit") ||
      (e.to === slug && e.from === "qkit"),
  );
  return e?.desc ?? "";
}

export function BlockTower({
  stacked,
  highlight,
  onHighlight,
}: {
  stacked: ReadonlySet<string>;
  highlight: string | null;
  onHighlight: (slug: string | null) => void;
}) {
  // render top → bottom so qkit lands at the base
  const blocks = STACK_ORDER.filter((s) => stacked.has(s)).reverse();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-stretch">
      {blocks.map((slug) => {
        const node = nodeBy(slug);
        const live = node.status === "live";
        const hot = highlight === slug;
        const dim = highlight && !hot;
        return (
          <div
            key={slug}
            onMouseEnter={() => onHighlight(slug)}
            onMouseLeave={() => onHighlight(null)}
            className={cn(
              "mb-2 rounded-xl border border-b-4 px-4 py-3 shadow-sm transition-all",
              live
                ? "border-gold bg-primary text-primary-foreground"
                : "border-primary/30 border-b-primary/40 bg-card",
              hot && "ring-2 ring-primary/40",
              dim && "opacity-45",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg font-bold">
                {node.short}
              </span>
              <span
                className={cn(
                  "font-mono text-xs",
                  live ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {slug}
              </span>
            </div>
            <p
              className={cn(
                "mt-0.5 text-xs",
                live ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {live
                ? "Your live queue."
                : queueLink(slug) || "Runs on its own."}
            </p>
          </div>
        );
      })}
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Every kit runs on its own — one account, one bill.
      </p>
      {blocks.length === 1 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Add a kit to stack it on top.
        </p>
      )}
    </div>
  );
}
