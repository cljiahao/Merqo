import { z } from "zod";
import type { RegistryRow } from "@/lib/products";

type VendorStatusSource = Pick<
  RegistryRow,
  "slug" | "app_url" | "metrics_secret"
>;

export type VendorStatusCheck =
  | { ok: true; slug: string; active: boolean; plan: string | null }
  | { ok: false; slug: string };

const vendorStatusSchema = z.object({
  active: z.boolean(),
  plan: z.string().nullable(),
});

/** One kit's answer to "is this email an active vendor of yours?" Never
 *  throws — mirrors fetchProductMetrics's never-throw error handling so one
 *  kit being down can't take out the sync for the others. */
export async function checkVendorStatus(
  kit: VendorStatusSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<VendorStatusCheck> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-status", kit.app_url);
    url.searchParams.set("email", email);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${kit.metrics_secret}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, slug: kit.slug };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, slug: kit.slug };
    }
    const parsed = vendorStatusSchema.safeParse(json);
    if (!parsed.success) return { ok: false, slug: kit.slug };
    return {
      ok: true,
      slug: kit.slug,
      active: parsed.data.active,
      plan: parsed.data.plan,
    };
  } catch {
    return { ok: false, slug: kit.slug };
  } finally {
    clearTimeout(timer);
  }
}
