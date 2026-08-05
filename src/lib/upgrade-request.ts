import type { RegistryRow } from "@/lib/products";
import { postKitAction, type KitActionResult } from "@/lib/kit-action-request";

type UpgradeRequestSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type UpgradeRequestResult = KitActionResult;

/** Ask one kit to file a monthly-Pro upgrade request for this email. Never
 *  throws — delegates to postKitAction's never-throw error handling so a
 *  kit being down degrades to a vendor-facing error message, not a crash. */
export async function requestKitUpgrade(
  kit: UpgradeRequestSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<UpgradeRequestResult> {
  return postKitAction(kit, "/api/merqo/upgrade-request", email, opts);
}
