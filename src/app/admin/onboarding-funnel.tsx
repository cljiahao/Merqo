import type { OnboardingCounts } from "@/lib/funnel";
import { Users } from "lucide-react";

const STAGES = [
  { key: "waitlisted", label: "Waitlisted" },
  { key: "granted", label: "Granted" },
  { key: "using", label: "Using" },
] as const;

/** Onboarding funnel — relative-magnitude bars across three counts.
 *  Deliberately shows no stage-to-stage conversion %: per OnboardingCounts'
 *  own contract, waitlisted/granted/using are distinct populations (not a
 *  single cohort narrowing stage to stage), so e.g. `using` routinely
 *  exceeds `granted` — a "% of previous stage" figure would read as a
 *  conversion rate but could print values like 200%, misrepresenting the
 *  data rather than merely rounding it oddly. */
export function OnboardingFunnelView({ counts }: { counts: OnboardingCounts }) {
  const top = Math.max(counts.waitlisted, counts.granted, counts.using, 1);
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="size-3.5" />
        Onboarding
      </h2>
      <div className="space-y-3">
        {STAGES.map((stage) => {
          const n = counts[stage.key];
          return (
            <div key={stage.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="font-mono tabular-nums">{n}</span>
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
