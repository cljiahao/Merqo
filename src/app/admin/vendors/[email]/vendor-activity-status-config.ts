import type { VendorActivityStatus } from "@/lib/vendor-activity-schema";

// One shared config across every kit's card, unlike each kit's own
// status-badge (which maps onto that kit's own brand tokens) — this is
// merqo's own console, so every card reads consistently regardless of
// which kit it's reporting on.
export const VENDOR_ACTIVITY_STATUS_CONFIG: Record<
  VendorActivityStatus,
  { label: string; className: string }
> = {
  attention: {
    label: "attention",
    className: "text-destructive border-destructive/35 bg-destructive/12",
  },
  expiring: {
    label: "expiring",
    className: "text-destructive border-destructive/35 bg-destructive/12",
  },
  stuck: {
    label: "stuck",
    className: "text-primary border-primary/35 bg-primary/12",
  },
  quiet: {
    label: "quiet",
    className: "text-muted-foreground border-border bg-muted",
  },
  new: {
    label: "new",
    className: "text-secondary-foreground border-secondary/35 bg-secondary/40",
  },
  healthy: {
    label: "healthy",
    className: "text-accent-foreground border-accent/35 bg-accent/40",
  },
};
