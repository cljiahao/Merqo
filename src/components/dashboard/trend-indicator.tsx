import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/format";
export function TrendIndicator({
  trend,
  className,
}: {
  trend: Trend;
  className?: string;
}) {
  if (trend.pct === null) return null;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5",
        trend.direction === "up" && "text-primary",
        trend.direction === "down" && "text-destructive",
        trend.direction === "flat" && "text-muted-foreground",
        className,
      )}
    >
      {trend.direction === "up" && <ArrowUp className="size-3" />}
      {trend.direction === "down" && <ArrowDown className="size-3" />}
      {trend.pct}%
    </span>
  );
}
