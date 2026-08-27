import { z } from "zod";

/** The shared triage vocabulary every kit's own vendor-health module
 *  produces (qkit/paykit/stockkit) — `expiring` is qkit-only (pass expiry
 *  has no equivalent elsewhere). A kit with no per-vendor health concept
 *  (loopkit today) reports `null`, not a fake "unknown" band. */
export const vendorStatusSchema = z.enum([
  "attention",
  "expiring",
  "stuck",
  "quiet",
  "new",
  "healthy",
]);

export type VendorActivityStatus = z.infer<typeof vendorStatusSchema>;

export const vendorActivityPayloadSchema = z.object({
  active: z.boolean(),
  plan: z.enum(["free", "pro"]).nullable(),
  status: vendorStatusSchema.nullable(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })),
  lastActivityAt: z.string().nullable(),
});

export type VendorActivityPayload = z.infer<typeof vendorActivityPayloadSchema>;
