import type { HealthStatus } from "@/lib/health";
import { Badge } from "@/components/ui/badge";
const HEALTH: Record<
  HealthStatus,
  { label: string; variant: "success" | "gold" | "destructive" }
> = {
  reporting: { label: "Reporting", variant: "success" },
  lagging: { label: "Lagging", variant: "gold" },
  down: { label: "Down", variant: "destructive" },
};
export function ProductHealthBadge({ status }: { status: HealthStatus }) {
  const badge = HEALTH[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
