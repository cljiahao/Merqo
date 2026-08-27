import {
  vendorActivityPayloadSchema,
  type VendorActivityPayload,
} from "@/lib/vendor-activity-schema";
import type { RegistryRow } from "@/lib/products";
import { fetchKitJson } from "@/lib/kit-action-request";

type VendorActivitySource = Pick<
  RegistryRow,
  "slug" | "app_url" | "metrics_secret"
>;

export type VendorActivityResult =
  | { ok: true; slug: string; data: VendorActivityPayload }
  | { ok: false; slug: string };

/** One kit's cross-schema activity summary for a single vendor — the
 *  `/admin/vendors/[email]` detail page's per-kit card. Never throws, same
 *  degrade-on-anything convention as fetchProductMetrics/checkVendorStatus:
 *  a kit that hasn't implemented this endpoint yet, 404s (vendor never
 *  touched it), or is briefly down all collapse to `ok: false` so the page
 *  just renders no card for that kit rather than an error. */
export async function getVendorActivity(
  kit: VendorActivitySource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<VendorActivityResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-activity", kit.app_url);
    url.searchParams.set("email", email);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const result = await fetchKitJson(
    url,
    vendorActivityPayloadSchema,
    { headers: { Authorization: `Bearer ${kit.metrics_secret}` } },
    opts.timeoutMs ?? 3000,
  );
  if (!result.ok) return { ok: false, slug: kit.slug };
  return { ok: true, slug: kit.slug, data: result.data };
}
