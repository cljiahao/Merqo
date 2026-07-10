import type { ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/format";

export function StatCard({
  label,
  value,
  accent = false,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: ComponentType<{ className?: string }>;
  trend?: Trend;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight tabular-nums",
            accent && "text-primary",
          )}
        >
          {value}
        </div>
        {trend && trend.pct !== null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trend.direction === "up" && "text-primary",
              trend.direction === "down" && "text-destructive",
              trend.direction === "flat" && "text-muted-foreground",
            )}
          >
            {trend.direction === "up" && <ArrowUp className="size-3" />}
            {trend.direction === "down" && <ArrowDown className="size-3" />}
            {trend.pct}%
          </span>
        )}
      </div>
    </div>
  );
}
