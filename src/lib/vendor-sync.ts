import { z } from "zod";
import type { RegistryRow } from "@/lib/products";
import { createServiceClient } from "@/lib/supabase/server";
import { listLiveProducts } from "@/lib/products";
import type { VendorLink } from "@/lib/vendor";
import { fetchKitJson } from "@/lib/kit-action-request";

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

  const result = await fetchKitJson(
    url,
    vendorStatusSchema,
    { headers: { Authorization: `Bearer ${kit.metrics_secret}` } },
    opts.timeoutMs ?? 5000,
  );
  if (!result.ok) return { ok: false, slug: kit.slug };
  return {
    ok: true,
    slug: kit.slug,
    active: result.data.active,
    plan: result.data.plan,
  };
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

/** How long a completed sync stays "fresh". The dashboard re-renders (and so
 *  re-syncs) on every visit now that it's open to every signed-in user — this
 *  keeps a burst of visits from fanning an HTTP call out to every kit each
 *  time, while still picking up a newly-joined kit within a minute. */
const SYNC_TTL_MS = 60_000;

async function readVendorLinks(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  email: string,
): Promise<VendorLink[]> {
  const { data, error } = await supabase
    .from("vendor_links")
    .select("product_slug, status, plan, last_verified_at")
    .eq("email", email);
  if (error) {
    console.error("vendor sync: read failed", error.message);
    return [];
  }
  return (data ?? []) as VendorLink[];
}

/**
 * Ask every live kit whether `email` is one of their active vendors, upsert
 * any positive matches into vendor_links, and return the vendor's current
 * links. Skips the kit fan-out when a sync completed less than SYNC_TTL_MS
 * ago (pass `force` to bypass — fresh logins do, via /post-login). Never
 * throws — a kit-down, network, or DB failure degrades to returning [] (the
 * caller then shows the same empty state it shows today, not an error page).
 */
export async function syncVendorKits(
  email: string,
  opts: { force?: boolean } = {},
): Promise<VendorLink[]> {
  try {
    const supabase = await createServiceClient();
    const normalizedEmail = email.toLowerCase();

    if (!opts.force) {
      const { data: state } = await supabase
        .from("vendor_sync_state")
        .select("last_synced_at")
        .eq("email", normalizedEmail)
        .maybeSingle();
      const syncedAt = state?.last_synced_at
        ? new Date(state.last_synced_at).getTime()
        : 0;
      if (Date.now() - syncedAt < SYNC_TTL_MS) {
        return readVendorLinks(supabase, normalizedEmail);
      }
    }

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

    const { error: stateError } = await supabase
      .from("vendor_sync_state")
      .upsert(
        { email: normalizedEmail, last_synced_at: new Date().toISOString() },
        { onConflict: "email" },
      );
    if (stateError) {
      console.error(
        "vendor sync: sync-state upsert failed",
        stateError.message,
      );
    }

    return readVendorLinks(supabase, normalizedEmail);
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
  | {
      ok: true;
      slug: string;
      alreadyExisted: boolean;
      plan: string | null;
      needsSetup?: boolean;
    }
  | { ok: false; slug: string };

const provisionResponseSchema = z.object({
  ok: z.literal(true),
  already_existed: z.boolean(),
  plan: z.string().nullable(),
  needs_setup: z.boolean().optional(),
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

  const result = await fetchKitJson(
    url,
    provisionResponseSchema,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.provision_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    },
    timeoutMs,
  );
  if (!result.ok) return { ok: false, slug: kit.slug };
  return {
    ok: true,
    slug: kit.slug,
    alreadyExisted: result.data.already_existed,
    plan: result.data.plan,
    needsSetup: result.data.needs_setup,
  };
}

/** Push-creates a vendor's tenant row on one kit. Never throws. One
 *  automatic retry on failure (short fixed delay, not a backoff series —
 *  this is a single low-volume internal call, not a public-facing
 *  webhook) — retry ownership lives HERE only, never inside a kit's own
 *  route, so retries can't compound across layers. 3s timeout per attempt
 *  (shorter than checkVendorStatus's 5s — this blocks a user-initiated
 *  write, not a best-effort background check). No retry when the kit is
 *  missing app_url/provision_secret — that's a config state, not a
 *  transient failure, so it can't change between now and 1.5s from now. */
export async function provisionVendorKit(
  kit: ProvisionSource,
  userId: string,
  opts: { timeoutMs?: number; retryDelayMs?: number } = {},
): Promise<ProvisionResult> {
  if (!kit.app_url || !kit.provision_secret) {
    return { ok: false, slug: kit.slug };
  }
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

  // A requested slug with no match in `targets` (kits.ts and the live
  // registry disagreeing, or a bogus slug) must still surface as a result —
  // otherwise the caller's byTargetSlug lookup sees `undefined`, not
  // `ok:false`, and silently drops the slug from both its success and
  // failure UI paths. results.length always equals slugs.length.
  const targetSlugs = new Set(targets.map((k) => k.slug));
  for (const slug of slugs) {
    if (!targetSlugs.has(slug)) results.push({ ok: false, slug });
  }

  const successes = results.filter(
    (r): r is Extract<ProvisionResult, { ok: true }> => r.ok,
  );
  if (successes.length > 0) {
    const nowIso = new Date().toISOString();
    const upserts = successes.map((s) => ({
      email: user.email.toLowerCase(),
      product_slug: s.slug,
      status: (s.needsSetup ? "needs_setup" : "active") as
        "active" | "needs_setup",
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
