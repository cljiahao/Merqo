"use client";
import { useState } from "react";
import { KIT_NODES, HUB_SLUG } from "@/lib/ecosystem";
import { Button } from "@/components/ui/button";
import { BlockTower } from "./block-tower";
import { ModuleList } from "./module-list";

const ALL_SLUGS = KIT_NODES.map((n) => n.slug);

/** Alternative "stack of blocks" view of the ecosystem — a prototype shown below
 *  the graph for comparison. qkit is the foundation; kits stack on top. */
export function BlockStacker() {
  const [stacked, setStacked] = useState<Set<string>>(
    () => new Set([HUB_SLUG]),
  );
  const [highlight, setHighlight] = useState<string | null>(null);

  function toggle(slug: string) {
    if (slug === HUB_SLUG) return;
    setStacked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const allStacked = ALL_SLUGS.every((s) => stacked.has(s));

  return (
    <section id="blocks" className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Alternative view · blocks
        </p>
        <h2 className="mt-3 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Or build it as a stack.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Same idea, blocks instead of a graph — qkit is the base and every kit
          stacks on top.
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border bg-secondary/30 p-6">
            <div className="mb-5 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStacked(new Set(ALL_SLUGS))}
                disabled={allStacked}
              >
                Stack all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStacked(new Set([HUB_SLUG]))}
              >
                Reset
              </Button>
            </div>
            <BlockTower
              stacked={stacked}
              highlight={highlight}
              onHighlight={setHighlight}
            />
          </div>

          <ModuleList
            stacked={stacked}
            onToggle={toggle}
            onHighlight={setHighlight}
          />
        </div>
      </div>
    </section>
  );
}
