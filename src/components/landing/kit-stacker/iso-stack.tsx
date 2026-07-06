import { KIT_NODES } from "@/lib/ecosystem";
import { cn } from "@/lib/utils";
import type { VizProps } from "./stacker-shell";

// bottom → top: qkit is the foundation
const STACK_ORDER = ["qkit", "loopkit", "shopkit", "tapkit", "slotkit"];
const nodeBy = (s: string) => KIT_NODES.find((n) => n.slug === s)!;

// block geometry in px: top-face footprint, thickness, gap between blocks
const W = 150;
const T = 30;
const GAP = 16;

export function IsoStack({ stacked, highlight, onHighlight }: VizProps) {
  const blocks = STACK_ORDER.filter((s) => stacked.has(s));

  return (
    <div
      className="flex min-h-[360px] items-center justify-center py-4"
      style={{ perspective: "1200px" }}
    >
      <div
        className="relative"
        style={{
          width: W,
          height: W,
          transformStyle: "preserve-3d",
          transform: "rotateX(58deg) rotateZ(-45deg)",
        }}
      >
        {blocks.map((s, i) => {
          const n = nodeBy(s);
          const live = n.status === "live";
          const hot = highlight === s;
          const top = live ? "var(--color-primary)" : "var(--color-card)";
          const front = live
            ? "color-mix(in oklab, var(--color-primary) 82%, black)"
            : "color-mix(in oklab, var(--color-card) 90%, black)";
          const side = live
            ? "color-mix(in oklab, var(--color-primary) 68%, black)"
            : "color-mix(in oklab, var(--color-card) 82%, black)";
          return (
            <div
              key={s}
              onMouseEnter={() => onHighlight(s)}
              onMouseLeave={() => onHighlight(null)}
              className="absolute inset-0 transition-transform"
              style={{
                transformStyle: "preserve-3d",
                transform: `translateZ(${i * (T + GAP)}px)`,
              }}
            >
              {/* top face */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-md border",
                  hot
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-black/10",
                )}
                style={{ transform: `translateZ(${T}px)`, background: top }}
              >
                <span
                  className={cn(
                    "font-display text-base font-bold",
                    live ? "text-primary-foreground" : "text-foreground",
                  )}
                  style={{ transform: "rotateZ(45deg) rotateX(-58deg)" }}
                >
                  {n.short}
                </span>
              </div>
              {/* front face */}
              <div
                className="absolute bottom-0 left-0 rounded-b-md"
                style={{
                  width: W,
                  height: T,
                  transformOrigin: "bottom",
                  transform: "rotateX(-90deg)",
                  background: front,
                }}
              />
              {/* right face */}
              <div
                className="absolute right-0 top-0 rounded-r-md"
                style={{
                  width: T,
                  height: W,
                  transformOrigin: "right",
                  transform: "rotateY(90deg)",
                  background: side,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
