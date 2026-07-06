import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}
