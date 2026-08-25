import type { ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { StatTile } from "@merqo/ui";
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
    // primary treatment — these are the admin overview's headline totals, so
    // they carry the same shadow+lift weight as a vendor's own live-kit card
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <StatTile
        label={label}
        value={value}
        valueClassName={cn(
          "font-display tracking-tight",
          accent && "text-primary",
        )}
        deltaSlot={
          Icon ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" />
          ) : undefined
        }
        valueTrailing={
          trend && trend.pct !== null ? (
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
          ) : undefined
        }
      />
    </div>
  );
}
