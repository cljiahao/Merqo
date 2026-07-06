import { describe, it, expect } from "vitest";
import {
  KIT_NODES,
  KIT_EDGES,
  HUB_SLUG,
  activeEdges,
  nodeBySlug,
} from "@/lib/ecosystem";

const slugs = new Set(KIT_NODES.map((n) => n.slug));

describe("ecosystem graph config", () => {
  it("has qkit as the hub node", () => {
    expect(HUB_SLUG).toBe("qkit");
    expect(nodeBySlug("qkit")?.status).toBe("live");
  });

  it("every edge references real nodes", () => {
    for (const e of KIT_EDGES) {
      expect(slugs.has(e.from)).toBe(true);
      expect(slugs.has(e.to)).toBe(true);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.desc.length).toBeGreaterThan(5);
    }
  });

  it("connects every kit into the graph when all are stacked", () => {
    const all = new Set(KIT_NODES.map((n) => n.slug));
    const edges = activeEdges(all);
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    for (const n of KIT_NODES) expect(linked.has(n.slug)).toBe(true);
  });

  it("only shows an edge when both endpoints are stacked", () => {
    expect(activeEdges(new Set(["qkit"]))).toHaveLength(0);
    const withLoop = activeEdges(new Set(["qkit", "loopkit"]));
    expect(withLoop).toHaveLength(1);
    expect(withLoop[0]).toMatchObject({ from: "qkit", to: "loopkit" });
  });

  it("has unique node positions", () => {
    const coords = KIT_NODES.map((n) => `${n.x},${n.y}`);
    expect(new Set(coords).size).toBe(coords.length);
  });
});
