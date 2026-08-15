/**
 * Data for the landing "kit stacker" graph — six standalone kits and the optional
 * integrations between them. Positions are fixed (art-directed, not physics) in a
 * stable viewBox; edges render only when BOTH their endpoints are stacked. No kit
 * is a required flagship — the graph shows connections, not dependencies.
 * Display-only; the waitlist source of truth stays in kits.ts. `status` is
 * derived from there (not hand-duplicated here) so the graph can't drift out
 * of sync with the real launch state the way a second copy would.
 */

import { KITS, type KitStatus } from "@/lib/kits";

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

type NodeLayout = Omit<KitNode, "status">;

const NODE_LAYOUT: NodeLayout[] = [
  { slug: "qkit", short: "Queue", x: 260, y: 80 },
  { slug: "shopkit", short: "Store", x: 120, y: 160 },
  { slug: "loopkit", short: "Loyalty", x: 400, y: 160 },
  { slug: "stockkit", short: "Stock", x: 120, y: 320 },
  { slug: "paykit", short: "Payments", x: 260, y: 380 },
  { slug: "reachkit", short: "Reach", x: 400, y: 320 },
];

const STATUS_BY_SLUG = new Map(KITS.map((k) => [k.slug, k.status]));

export const KIT_NODES: KitNode[] = NODE_LAYOUT.map((n) => ({
  ...n,
  status: STATUS_BY_SLUG.get(n.slug) ?? "planned",
}));

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
