import { z } from "zod";

export const metricsPayloadSchema = z.object({
  product: z.string(),
  generated_at: z.string(),
  revenue_cents_30d: z.number(),
  revenue_cents_all: z.number(),
  gmv_cents_30d: z.number(),
  active_vendors: z.number(),
  orders_7d: z.number(),
  orders_prev_7d: z.number(),
  signups_7d: z.number(),
  pro_vendors: z.number(),
  total_vendors: z.number(),
  pending_upgrade_requests: z.number(),
  funnel: z.object({
    signed_up: z.number(),
    with_booth: z.number(),
    with_order: z.number(),
    pro: z.number(),
  }),
});

export type MetricsPayload = z.infer<typeof metricsPayloadSchema>;
