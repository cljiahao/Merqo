"use server";

import { loadVendorContext, hasActiveLinkFor } from "@/lib/vendor";
import { listLiveProducts } from "@/lib/products";
import { requestKitDowngrade } from "@/lib/downgrade-request";

export type DowngradeActionResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** Flip `slug` back to free for the signed-in vendor. Independently
 *  re-checks that the vendor actually holds an active link to that kit —
 *  the UI only ever renders this action's button for a kit the vendor
 *  uses, but a direct invocation must not bypass that. */
export async function requestDowngrade(
  slug: string,
): Promise<DowngradeActionResult> {
  try {
    const { user, links } = await loadVendorContext();
    if (!user?.email) {
      return { success: false, error: "Please sign in first." };
    }
    if (!hasActiveLinkFor(links, slug)) {
      return { success: false, error: GENERIC_ERROR };
    }

    const products = await listLiveProducts();
    const kit = products.find((p) => p.slug === slug);
    if (!kit) {
      return { success: false, error: GENERIC_ERROR };
    }

    return requestKitDowngrade(kit, user.email);
  } catch (err) {
    console.error("requestDowngrade: unexpected failure", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
