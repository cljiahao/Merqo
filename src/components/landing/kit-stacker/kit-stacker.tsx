"use client";
import { useState } from "react";
import { KIT_NODES, HUB_SLUG } from "@/lib/ecosystem";
import { Button } from "@/components/ui/button";
import { GraphCanvas } from "./graph-canvas";
import { ModuleList } from "./module-list";
import { StackerA11ySummary } from "./stacker-a11y-summary";
import { Timeline } from "./timeline";

const ALL_SLUGS = KIT_NODES.map((n) => n.slug);

export function KitStacker() {
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
    <section id="kits" className="border-t bg-secondary/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Stack your kit
        </p>
        <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
          One queue. Click a kit to see how it snaps on.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Everything flows through qkit. Add the tools you need and watch them
          connect — one account, one bill.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Your stack
              </span>
              <div className="flex gap-2">
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
            </div>
            <div className="mt-3">
              <GraphCanvas
                stacked={stacked}
                highlight={highlight}
                onHighlight={setHighlight}
              />
            </div>
            <Timeline />
          </div>

          <ModuleList
            stacked={stacked}
            onToggle={toggle}
            onHighlight={setHighlight}
          />
        </div>

        <StackerA11ySummary stacked={stacked} />
      </div>
    </section>
  );
}
