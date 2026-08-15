"use server";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

/** Mark a hub-level support message resolved. Team-gated; writes via the
 *  service client since resolving isn't the submitter's own action. */
export async function resolveSupportMessageAction(
  id: string,
): Promise<ActionResult> {
  await requireMerqoTeam();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("support_messages")
    .update({ status: "resolved" })
    .eq("id", id);
  if (error) {
    console.error("resolveSupportMessageAction failed", error.message);
    return { success: false, error: "Could not resolve" };
  }
  revalidatePath("/admin");
  return { success: true };
}

/** Flip the cross-kit bundle-discount flag. Team-gated; writes the
 *  singleton `merqo.billing_settings` row via the service client — no
 *  RLS policy grants UPDATE to any client role. No kit reads this flag
 *  yet (see docs/superpowers/specs/2026-08-16-bundle-discount-toggle-design.md);
 *  this only persists the switch's state. */
export async function setBundleDiscountEnabledAction(
  enabled: boolean,
): Promise<ActionResult> {
  await requireMerqoTeam();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("billing_settings")
    .update({
      bundle_discount_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("setBundleDiscountEnabledAction failed", error.message);
    return { success: false, error: "Could not update setting" };
  }
  revalidatePath("/admin");
  return { success: true };
}
