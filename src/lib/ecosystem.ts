/**
 * Data for the landing "kit stacker" graph — the curated hub-and-spoke layout of
 * the kit family and how each kit plugs into the queue. Positions are fixed (art-
 * directed, not physics) in a stable viewBox; edges render only when BOTH their
 * endpoints are stacked. Display-only; the waitlist source of truth stays in
 * kits.ts. Keep slugs in sync with kits.ts.
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
  { slug: "qkit", short: "Queue", status: "live", x: 260, y: 220 },
  { slug: "shopkit", short: "Store", status: "coming", x: 110, y: 108 },
  { slug: "loopkit", short: "Loyalty", status: "coming", x: 410, y: 108 },
  { slug: "tapkit", short: "Payments", status: "planned", x: 110, y: 332 },
  { slug: "slotkit", short: "Bookings", status: "planned", x: 410, y: 332 },
];

export const KIT_EDGES: KitEdge[] = [
  {
    from: "shopkit",
    to: "qkit",
    label: "orders",
    desc: "Online orders drop into your queue.",
  },
  {
    from: "slotkit",
    to: "qkit",
    label: "bookings",
    desc: "Bookings join the same queue.",
  },
  {
    from: "qkit",
    to: "loopkit",
    label: "points",
    desc: "Finished orders earn loyalty points.",
  },
  {
    from: "tapkit",
    to: "qkit",
    label: "payments",
    desc: "Take payment as the order is placed.",
  },
  {
    from: "tapkit",
    to: "shopkit",
    label: "checkout",
    desc: "Powers checkout on your store.",
  },
];

/** The anchor kit — always stacked, can't be removed (it's live + the hub). */
export const HUB_SLUG = "qkit";

export function nodeBySlug(slug: string): KitNode | undefined {
  return KIT_NODES.find((n) => n.slug === slug);
}

/** Edges whose both endpoints are currently stacked. */
export function activeEdges(stacked: ReadonlySet<string>): KitEdge[] {
  return KIT_EDGES.filter((e) => stacked.has(e.from) && stacked.has(e.to));
}
