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
  plan: string | null;
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
      plan: c.plan,
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
      .select("product_slug, status, plan")
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

type ProvisionSource = Pick<
  RegistryRow,
  "slug" | "app_url" | "provision_secret"
>;

export type ProvisionResult =
  | { ok: true; slug: string; alreadyExisted: boolean; plan: string | null }
  | { ok: false; slug: string };

const provisionResponseSchema = z.object({
  ok: z.literal(true),
  already_existed: z.boolean(),
  plan: z.enum(["free", "pro"]),
});

async function provisionOnce(
  kit: ProvisionSource,
  userId: string,
  timeoutMs: number,
): Promise<ProvisionResult> {
  if (!kit.app_url || !kit.provision_secret) {
    return { ok: false, slug: kit.slug };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/vendor-provision", kit.app_url);
  } catch {
    return { ok: false, slug: kit.slug };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.provision_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
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
    const parsed = provisionResponseSchema.safeParse(json);
    if (!parsed.success) return { ok: false, slug: kit.slug };
    return {
      ok: true,
      slug: kit.slug,
      alreadyExisted: parsed.data.already_existed,
      plan: parsed.data.plan,
    };
  } catch {
    return { ok: false, slug: kit.slug };
  } finally {
    clearTimeout(timer);
  }
}

/** Push-creates a vendor's tenant row on one kit. Never throws. One
 *  automatic retry on failure (short fixed delay, not a backoff series —
 *  this is a single low-volume internal call, not a public-facing
 *  webhook) — retry ownership lives HERE only, never inside a kit's own
 *  route, so retries can't compound across layers. 3s timeout per attempt
 *  (shorter than checkVendorStatus's 5s — this blocks a user-initiated
 *  write, not a best-effort background check). */
export async function provisionVendorKit(
  kit: ProvisionSource,
  userId: string,
  opts: { timeoutMs?: number; retryDelayMs?: number } = {},
): Promise<ProvisionResult> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const first = await provisionOnce(kit, userId, timeoutMs);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 1500));
  return provisionOnce(kit, userId, timeoutMs);
}

/** Provisions every slug in `slugs` (a subset of the live registry) in
 *  parallel via allSettled — never Promise.all, one kit's failure must
 *  never mask another's success. Upserts vendor_links only for
 *  successful provisions and returns both the vendor's current links AND
 *  the raw per-kit outcome list, so the caller can render partial
 *  results (which kit succeeded, which still failed after the retry). */
export async function provisionVendorKits(
  user: { id: string; email: string },
  slugs: string[],
): Promise<{ links: VendorLink[]; results: ProvisionResult[] }> {
  const supabase = await createServiceClient();
  const allLive = await listLiveProducts();
  const targets = allLive.filter((k) => slugs.includes(k.slug));

  const settled = await Promise.allSettled(
    targets.map((kit) => provisionVendorKit(kit, user.id)),
  );
  const results: ProvisionResult[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : { ok: false, slug: targets[i].slug },
  );

  const successes = results.filter(
    (r): r is Extract<ProvisionResult, { ok: true }> => r.ok,
  );
  if (successes.length > 0) {
    const nowIso = new Date().toISOString();
    const upserts = successes.map((s) => ({
      email: user.email.toLowerCase(),
      product_slug: s.slug,
      status: "active" as const,
      last_verified_at: nowIso,
      plan: s.plan,
    }));
    const { error } = await supabase
      .from("vendor_links")
      .upsert(upserts, { onConflict: "email,product_slug" });
    if (error) {
      console.error("provisionVendorKits: upsert failed", error.message);
    }
  }

  const { data, error: readError } = await supabase
    .from("vendor_links")
    .select("product_slug, status, plan")
    .eq("email", user.email.toLowerCase());
  if (readError) {
    console.error("provisionVendorKits: read failed", readError.message);
    return { links: [], results };
  }
  return { links: (data ?? []) as VendorLink[], results };
}
