import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { classifyOverviewHealth } from "@/lib/health";

/** Single-line, color-coded, icon-led status for the whole product
 *  ecosystem — replaces a plain-text caption so the overall picture is
 *  visible without reading numbers. */
export function StatusBanner({
  reporting,
  lagging,
  down,
}: {
  reporting: number;
  lagging: number;
  down: number;
}) {
  const status = classifyOverviewHealth(down, lagging);

  if (status === "down") {
    const parts = [`${reporting} reporting`];
    if (lagging > 0) parts.push(`${lagging} lagging`);
    parts.push(`${down} down`);
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
        <AlertCircle className="size-5 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {parts.join(" · ")}
        </p>
      </div>
    );
  }

  if (status === "lagging") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <AlertTriangle className="size-5 shrink-0 text-gold-foreground" />
        <p className="text-sm font-medium text-gold-foreground">
          {reporting} reporting · {lagging} lagging
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
      <CheckCircle2 className="size-5 shrink-0 text-primary" />
      <p className="text-sm font-medium text-primary">
        All {reporting} products reporting
      </p>
    </div>
  );
}
