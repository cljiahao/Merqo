"use client";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { KIT_NODES, HUB_SLUG } from "@/lib/ecosystem";
import { Button } from "@/components/ui/button";
import { GraphCanvas, type Journey } from "./graph-canvas";
import { BlockTower } from "./block-tower";
import { ModuleList } from "./module-list";
import { StackerA11ySummary } from "./stacker-a11y-summary";
import { Timeline } from "./timeline";

const ALL_SLUGS = KIT_NODES.map((n) => n.slug);

// The order's journey through the stack. Only the stacked stops play.
const JOURNEY_STEPS = [
  { slug: "shopkit", caption: "A customer orders from your store." },
  { slug: "qkit", caption: "The order drops into your queue." },
  { slug: "tapkit", caption: "Payment is taken on the spot." },
  { slug: "loopkit", caption: "They earn points — and come back." },
];
const STEP_MS = 780;

export function KitStacker() {
  const [stacked, setStacked] = useState<Set<string>>(
    () => new Set([HUB_SLUG]),
  );
  const [highlight, setHighlight] = useState<string | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [lit, setLit] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  // any stack change clears the journey overlay so it can't go stale
  function resetJourney() {
    clearTimers();
    setJourney(null);
    setLit(new Set());
    setCaption(null);
  }

  function toggle(slug: string) {
    if (slug === HUB_SLUG) return;
    resetJourney();
    setStacked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function setStack(slugs: string[]) {
    resetJourney();
    setStacked(new Set(slugs));
  }

  useEffect(() => clearTimers, []);

  const route = JOURNEY_STEPS.filter((s) => stacked.has(s.slug));
  const canPlay = route.length >= 2;

  function playJourney() {
    clearTimers();
    if (!canPlay) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setLit(new Set(route.map((r) => r.slug)));
      setCaption(route[route.length - 1].caption);
      setJourney(null);
      return;
    }
    setLit(new Set([route[0].slug]));
    setCaption(route[0].caption);
    setJourney(null);

    let i = 0;
    const step = () => {
      if (i >= route.length - 1) {
        setJourney(null);
        return;
      }
      const from = route[i].slug;
      const to = route[i + 1].slug;
      setJourney({ from, to, step: i });
      const t = window.setTimeout(() => {
        setLit((prev) => new Set(prev).add(to));
        setCaption(route[i + 1].caption);
        i += 1;
        step();
      }, STEP_MS);
      timers.current.push(t);
    };
    step();
  }

  const allStacked = ALL_SLUGS.every((s) => stacked.has(s));

  return (
    <section id="kits" className="border-t bg-secondary/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Stack your kit
        </p>
        <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
          One queue. Watch how the kits connect.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Everything flows through qkit. Add the tools you need, then play the
          journey to see an order move through them.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Your stack
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={playJourney}
                  disabled={!canPlay}
                  className="hidden lg:inline-flex"
                >
                  <Play className="size-3.5" />
                  Play journey
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStack(ALL_SLUGS)}
                  disabled={allStacked}
                >
                  Stack all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStack([HUB_SLUG])}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* graph on desktop; the block tower reads better on phones */}
            <div className="mt-3 hidden lg:block">
              <GraphCanvas
                stacked={stacked}
                highlight={highlight}
                onHighlight={setHighlight}
                journey={journey}
                litNodes={lit}
              />
              <p
                aria-live="polite"
                className="mt-1 min-h-5 text-center text-sm font-medium text-foreground"
              >
                {caption ??
                  (canPlay
                    ? "Press play to trace an order through your stack."
                    : "Add a kit to trace an order's journey.")}
              </p>
            </div>
            <div className="mt-4 lg:hidden">
              <BlockTower
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
