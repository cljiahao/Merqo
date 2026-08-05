import {
  vendorMetricsPayloadSchema,
  type VendorMetricsPayload,
} from "@/lib/vendor-metrics-schema";
import type { RegistryRow } from "@/lib/products";
import { fetchKitJson } from "@/lib/kit-action-request";

type VendorMetricsSource = Pick<
  RegistryRow,
  "slug" | "app_url" | "metrics_secret"
>;

export type VendorMetricsResult =
  | { ok: true; slug: string; data: VendorMetricsPayload }
  | { ok: false; slug: string };

/** One kit's answer to "what are this vendor's own numbers here?" Never
 *  throws — same degrade-on-anything convention as fetchProductMetrics and
 *  checkVendorStatus, since a kit that hasn't implemented this endpoint yet
 *  (or is briefly down) should render a plain "not connected" state, not
 *  break the page. */
export async function fetchVendorMetrics(
  kit: VendorMetricsSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<VendorMetricsResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-metrics", kit.app_url);
    url.searchParams.set("email", email);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const result = await fetchKitJson(
    url,
    vendorMetricsPayloadSchema,
    { headers: { Authorization: `Bearer ${kit.metrics_secret}` } },
    opts.timeoutMs ?? 2000,
  );
  if (!result.ok) return { ok: false, slug: kit.slug };
  return { ok: true, slug: kit.slug, data: result.data };
}
