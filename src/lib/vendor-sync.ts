import { z } from "zod";
import type { RegistryRow } from "@/lib/products";
import { createServiceClient } from "@/lib/supabase/server";
import { listLiveProducts } from "@/lib/products";
import type { VendorLink } from "@/lib/vendor";

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

/** Which check results should become active vendor_links rows. Pure. */
export function upsertsFromChecks(
  email: string,
  checks: VendorStatusCheck[],
  nowIso: string,
): {
  email: string;
  product_slug: string;
  status: "active";
  last_verified_at: string;
}[] {
  return checks
    .filter(
      (c): c is Extract<VendorStatusCheck, { ok: true }> => c.ok && c.active,
    )
    .map((c) => ({
      email: email.toLowerCase(),
      product_slug: c.slug,
      status: "active" as const,
      last_verified_at: nowIso,
    }));
}

/**
 * Ask every live kit whether `email` is one of their active vendors, upsert
 * any positive matches into vendor_links, and return the vendor's current
 * links. Never throws — a kit-down, network, or DB failure degrades to
 * returning [] (the caller then shows the same empty state it shows today,
 * not an error page).
 */
export async function syncVendorKits(email: string): Promise<VendorLink[]> {
  try {
    const supabase = await createServiceClient();
    const kits = await listLiveProducts();
    const checks = await Promise.all(
      kits.map((kit) => checkVendorStatus(kit, email)),
    );
    const upserts = upsertsFromChecks(email, checks, new Date().toISOString());

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("vendor_links")
        .upsert(upserts, { onConflict: "email,product_slug" });
      if (error) {
        console.error("vendor sync: upsert failed", error.message);
        return [];
      }
    }

    const { data, error: readError } = await supabase
      .from("vendor_links")
      .select("product_slug, status")
      .eq("email", email.toLowerCase());
    if (readError) {
      console.error("vendor sync: read failed", readError.message);
      return [];
    }
    return (data ?? []) as VendorLink[];
  } catch (err) {
    console.error("vendor sync: unexpected failure", err);
    return [];
  }
}
