import { z } from "zod";

/** One kit-chosen stat — the kit picks content, units and formatting, since
 *  "stamps redeemed" and "collected this month" aren't the same kind of
 *  number. See docs/superpowers/specs/2026-07-26-vendor-stats-overview-design.md. */
export const vendorMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  hint: z.string().optional(),
});

export const vendorMetricsPayloadSchema = z.object({
  product: z.string(),
  generated_at: z.string().datetime(),
  metrics: z.array(vendorMetricSchema).max(8),
});

export type VendorMetric = z.infer<typeof vendorMetricSchema>;
export type VendorMetricsPayload = z.infer<typeof vendorMetricsPayloadSchema>;
