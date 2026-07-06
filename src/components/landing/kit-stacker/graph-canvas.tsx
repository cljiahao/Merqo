import {
  KIT_NODES,
  KIT_EDGES,
  GRAPH_VIEWBOX,
  nodeBySlug,
} from "@/lib/ecosystem";
import { cn } from "@/lib/utils";

const NODE_W = 98;
const NODE_H = 48;

function neighborsOf(slug: string): Set<string> {
  const out = new Set<string>();
  for (const e of KIT_EDGES) {
    if (e.from === slug) out.add(e.to);
    if (e.to === slug) out.add(e.from);
  }
  return out;
}

export function GraphCanvas({
  stacked,
  highlight,
  onHighlight,
}: {
  stacked: ReadonlySet<string>;
  highlight: string | null;
  onHighlight: (slug: string | null) => void;
}) {
  const hotNeighbors = highlight ? neighborsOf(highlight) : null;

  return (
    <svg
      viewBox={`0 0 ${GRAPH_VIEWBOX.w} ${GRAPH_VIEWBOX.h}`}
      role="img"
      aria-labelledby="stacker-title stacker-desc"
      className="h-auto w-full"
    >
      <title id="stacker-title">Merqo kit ecosystem</title>
      <desc id="stacker-desc">
        A diagram of the Merqo kits and how each connects through the queue.
      </desc>

      {KIT_EDGES.map((e) => {
        if (!stacked.has(e.from) || !stacked.has(e.to)) return null;
        const a = nodeBySlug(e.from)!;
        const b = nodeBySlug(e.to)!;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dim = highlight
          ? highlight !== e.from && highlight !== e.to
          : false;
        const chipW = e.label.length * 7 + 16;
        return (
          <g
            key={`${e.from}-${e.to}`}
            className={cn(
              "transition-opacity duration-300",
              dim && "opacity-20",
            )}
          >
            <path
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              strokeWidth={2}
              strokeLinecap="round"
              className="edge-draw fill-none stroke-primary/55"
            />
            <g className="edge-label">
              <rect
                x={mx - chipW / 2}
                y={my - 10}
                width={chipW}
                height={20}
                rx={10}
                strokeWidth={1}
                className="fill-card stroke-border"
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {e.label}
              </text>
            </g>
          </g>
        );
      })}

      {KIT_NODES.map((n) => {
        const on = stacked.has(n.slug);
        const dim =
          highlight && highlight !== n.slug && !hotNeighbors?.has(n.slug);
        const live = n.status === "live";
        return (
          <g
            key={n.slug}
            transform={`translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`}
            onMouseEnter={() => onHighlight(n.slug)}
            onMouseLeave={() => onHighlight(null)}
            className={cn(
              "transition-opacity duration-300",
              on ? "opacity-100" : "opacity-45",
              dim && "opacity-25",
            )}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={13}
              strokeWidth={live && on ? 2.5 : 1.5}
              className={cn(
                on
                  ? live
                    ? "fill-primary stroke-gold"
                    : "fill-card stroke-primary/40"
                  : "fill-transparent stroke-border [stroke-dasharray:4_4]",
              )}
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 - 2}
              textAnchor="middle"
              className={cn(
                "font-display text-[13px] font-bold",
                on
                  ? live
                    ? "fill-primary-foreground"
                    : "fill-foreground"
                  : "fill-muted-foreground",
              )}
            >
              {n.short}
            </text>
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 13}
              textAnchor="middle"
              className={cn(
                "font-mono text-[9px]",
                on && live
                  ? "fill-primary-foreground/80"
                  : "fill-muted-foreground/80",
              )}
            >
              {n.slug}
            </text>
            {live && (
              <circle cx={NODE_W - 13} cy={13} r={4} className="fill-gold" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
