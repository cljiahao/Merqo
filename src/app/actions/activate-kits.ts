"use server";

import { revalidatePath } from "next/cache";
import { loadVendorContext } from "@/lib/vendor";
import { provisionVendorKits, type ProvisionResult } from "@/lib/vendor-sync";

export type ActivateKitsResult =
  | { success: true; results: ProvisionResult[] }
  | { success: false; error: string };

const GENERIC_ERROR = "Could not activate your kits. Try again in a moment.";

/** Provisions the signed-in vendor into every slug in `slugs` (bulk
 *  "Activate all my kits" passes every kit currently supporting
 *  provisioning; a single-kit "Add {kit}" passes one). */
export async function activateKitsAction(
  slugs: string[],
): Promise<ActivateKitsResult> {
  const { user } = await loadVendorContext();
  if (!user?.email) {
    return { success: false, error: "Please sign in first." };
  }

  try {
    const { results } = await provisionVendorKits(
      { id: user.id, email: user.email },
      slugs,
    );
    revalidatePath("/dashboard");
    return { success: true, results };
  } catch (err) {
    console.error("activateKitsAction: unexpected failure", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
