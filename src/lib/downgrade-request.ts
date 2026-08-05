import type { RegistryRow } from "@/lib/products";
import { postKitAction, type KitActionResult } from "@/lib/kit-action-request";

type DowngradeRequestSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type DowngradeRequestResult = KitActionResult;

/** Ask one kit to instantly flip this email back to free. Never throws —
 *  delegates to postKitAction's never-throw error handling so a kit being
 *  down degrades to a vendor-facing error message, not a crash. */
export async function requestKitDowngrade(
  kit: DowngradeRequestSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<DowngradeRequestResult> {
  return postKitAction(kit, "/api/merqo/downgrade-request", email, opts);
}
