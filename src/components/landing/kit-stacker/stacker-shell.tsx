"use client";
import { useState } from "react";
import { KIT_NODES, HUB_SLUG } from "@/lib/ecosystem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModuleList } from "./module-list";
import { GraphCanvas } from "./graph-canvas";
import { BlockTower } from "./block-tower";
import { FlowJourney } from "./flow-journey";
import { IsoStack } from "./iso-stack";

const ALL_SLUGS = KIT_NODES.map((n) => n.slug);

export type VizProps = {
  stacked: ReadonlySet<string>;
  highlight: string | null;
  onHighlight: (slug: string | null) => void;
};

export type StackerVariant = "graph" | "blocks" | "flow" | "iso";

/** Generic stacker section: owns the stack state + Stack all/Reset + module
 *  list, and renders the chosen visualization. Used to A/B the graph / blocks /
 *  flow / iso views side by side. */
export function StackerShell({
  eyebrow,
  title,
  subtitle,
  id,
  variant,
  vizClassName,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  id?: string;
  variant: StackerVariant;
  vizClassName?: string;
}) {
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
  const vizProps: VizProps = { stacked, highlight, onHighlight: setHighlight };

  return (
    <section id={id} className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 max-w-xl text-muted-foreground">{subtitle}</p>
        )}

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-sm sm:p-6",
              vizClassName,
            )}
          >
            <div className="mb-4 flex items-center justify-between">
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
            {variant === "graph" && <GraphCanvas {...vizProps} />}
            {variant === "blocks" && <BlockTower {...vizProps} />}
            {variant === "flow" && <FlowJourney {...vizProps} />}
            {variant === "iso" && <IsoStack {...vizProps} />}
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
