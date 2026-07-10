import type { OnboardingCounts } from "@/lib/funnel";
import { Users } from "lucide-react";

const STAGES = [
  { key: "waitlisted", label: "Waitlisted" },
  { key: "granted", label: "Granted" },
  { key: "using", label: "Using" },
] as const;

/** Onboarding funnel with drop-off bars + step-conversion %. */
export function OnboardingFunnelView({ counts }: { counts: OnboardingCounts }) {
  const top = Math.max(counts.waitlisted, counts.granted, counts.using, 1);
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="size-3.5" />
        Onboarding
      </h2>
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const n = counts[stage.key];
          const prev = i === 0 ? n : counts[STAGES[i - 1].key];
          const stepPct = prev ? Math.round((n / prev) * 100) : 0;
          return (
            <div key={stage.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="font-mono tabular-nums">
                  {n}
                  {i > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {stepPct}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(n / top) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
