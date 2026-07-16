import { describe, it, expect } from "vitest";
import {
  KIT_NODES,
  KIT_EDGES,
  DEFAULT_STACKED,
  activeEdges,
  nodeBySlug,
} from "@/lib/ecosystem";

const slugs = new Set(KIT_NODES.map((n) => n.slug));

describe("ecosystem graph config", () => {
  it("has the six kits and no retired slugs", () => {
    expect(slugs).toEqual(
      new Set(["qkit", "loopkit", "shopkit", "paykit", "stockkit", "reachkit"]),
    );
    expect(slugs.has("slotkit")).toBe(false);
    expect(slugs.has("tapkit")).toBe(false);
  });

  it("defaults the stack to qkit (the live kit), but it is not special", () => {
    expect(DEFAULT_STACKED).toBe("qkit");
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

  it("links every kit except the standalone stockkit when all are stacked", () => {
    const edges = activeEdges(new Set(KIT_NODES.map((n) => n.slug)));
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    for (const n of KIT_NODES) {
      // stockkit stands alone by design
      if (n.slug === "stockkit") continue;
      expect(linked.has(n.slug)).toBe(true);
    }
    expect(linked.has("stockkit")).toBe(false);
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
