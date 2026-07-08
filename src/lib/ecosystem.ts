/**
 * Data for the landing "kit stacker" graph — six standalone kits and the optional
 * integrations between them. Positions are fixed (art-directed, not physics) in a
 * stable viewBox; edges render only when BOTH their endpoints are stacked. No kit
 * is a required flagship — the graph shows connections, not dependencies.
 * Display-only; the waitlist source of truth stays in kits.ts. Keep slugs in sync.
 */

export type KitStatus = "live" | "coming" | "planned";

export type KitNode = {
  slug: string;
  /** Short label shown on the node, e.g. "Queue". */
  short: string;
  status: KitStatus;
  x: number;
  y: number;
};

export type KitEdge = {
  from: string;
  to: string;
  /** 1-word chip shown at the edge midpoint. */
  label: string;
  /** Full sentence for the tooltip + the screen-reader summary. */
  desc: string;
};

export const GRAPH_VIEWBOX = { w: 520, h: 440 };

export const KIT_NODES: KitNode[] = [
  { slug: "qkit", short: "Queue", status: "live", x: 260, y: 80 },
  { slug: "shopkit", short: "Store", status: "planned", x: 120, y: 160 },
  { slug: "loopkit", short: "Loyalty", status: "coming", x: 400, y: 160 },
  { slug: "stockkit", short: "Stock", status: "planned", x: 120, y: 320 },
  { slug: "paykit", short: "Payments", status: "planned", x: 260, y: 380 },
  { slug: "reachkit", short: "Reach", status: "planned", x: 400, y: 320 },
];

export const KIT_EDGES: KitEdge[] = [
  {
    from: "qkit",
    to: "loopkit",
    label: "points",
    desc: "Finished orders earn loyalty points.",
  },
  {
    from: "paykit",
    to: "qkit",
    label: "pay",
    desc: "Take payment as the order is placed.",
  },
  {
    from: "shopkit",
    to: "qkit",
    label: "orders",
    desc: "Online orders drop into your queue.",
  },
  {
    from: "paykit",
    to: "shopkit",
    label: "checkout",
    desc: "Powers checkout on your store.",
  },
  {
    from: "qkit",
    to: "reachkit",
    label: "reviews",
    desc: "Ask for a review after a visit.",
  },
];

/** The kit the stacker starts (and resets) with — qkit, the live one. It is a
 *  sensible starting point, NOT a required anchor: it can be unstacked like any
 *  other kit (no flagship). */
export const DEFAULT_STACKED = "qkit";

export function nodeBySlug(slug: string): KitNode | undefined {
  return KIT_NODES.find((n) => n.slug === slug);
}

/** Edges whose both endpoints are currently stacked. */
export function activeEdges(stacked: ReadonlySet<string>): KitEdge[] {
  return KIT_EDGES.filter((e) => stacked.has(e.from) && stacked.has(e.to));
}
