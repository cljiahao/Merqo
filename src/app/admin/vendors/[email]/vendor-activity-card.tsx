import { StatTile, StatusBadge } from "@merqo/ui";
import { Badge } from "@/components/ui/badge";
import type { VendorActivityResult } from "@/lib/vendor-activity-client";
import { VENDOR_ACTIVITY_STATUS_CONFIG } from "./vendor-activity-status-config";
import { timeAgo } from "@/lib/format";

/** One kit's activity summary on the vendor detail page. A kit that
 *  hasn't implemented `/api/merqo/vendor-activity` yet, or is briefly
 *  unreachable, renders nothing here — never a broken-looking card (same
 *  degrade-never-fail convention the metrics pull already follows). */
export function VendorActivityCard({
  slug,
  result,
  now,
}: {
  slug: string;
  result: VendorActivityResult;
  now: number;
}) {
  if (!result.ok || !result.data.active) return null;
  const { plan, status, metrics, lastActivityAt } = result.data;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{slug}</span>
        <div className="flex items-center gap-1.5">
          {status && (
            <StatusBadge
              status={status}
              config={VENDOR_ACTIVITY_STATUS_CONFIG}
            />
          )}
          {plan === "pro" ? (
            <Badge className="border-0 px-1.5 py-0">Pro</Badge>
          ) : (
            <Badge variant="muted" className="border-0 px-1.5 py-0">
              Free
            </Badge>
          )}
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No metrics reported.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <StatTile key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      )}

      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        {lastActivityAt
          ? `Last activity ${timeAgo(lastActivityAt, now)}`
          : "No activity recorded"}
      </p>
    </div>
  );
}
