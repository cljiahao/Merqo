import { createServiceClient } from "@/lib/supabase/server";

export interface BillingSettings {
  bundle_discount_enabled: boolean;
}

/** Fallback when the row can't be read - keeps the admin page rendering
 * (mirrors qkit's DEFAULT_PRICING fallback shape). */
export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  bundle_discount_enabled: false,
};

export async function getBillingSettings(): Promise<BillingSettings> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("billing_settings")
    .select("bundle_discount_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_BILLING_SETTINGS;
  return data;
}
