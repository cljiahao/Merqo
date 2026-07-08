import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { KITS } from "@/lib/kits";
import type { GrantStatus } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

export type HomeDestination = "/admin" | "/dashboard" | "/dashboard/pending";

export type KitTile = {
  slug: string;
  name: string;
  tagline: string;
  href: string | null;
};

export type VendorLink = { product_slug: string; status: GrantStatus };

/** Where a signed-in user belongs. Pure so it can be unit-tested; callers
 *  supply the two facts (team membership, whether any kit is active). */
export function resolveHome(input: {
  isTeam: boolean;
  hasActiveKit: boolean;
}): HomeDestination {
  if (input.isTeam) return "/admin";
  if (input.hasActiveKit) return "/dashboard";
  return "/dashboard/pending";
}

/** Map a vendor's link rows onto display tiles via the static KITS config.
 *  KITS is the display allow-list — an unknown slug is dropped, not rendered. */
export function tilesForLinks(
  links: { product_slug: string; status: GrantStatus }[],
): { active: KitTile[]; pending: KitTile[] } {
  const bySlug = new Map(KITS.map((k) => [k.slug, k]));
  const active: KitTile[] = [];
  const pending: KitTile[] = [];
  for (const l of links) {
    const kit = bySlug.get(l.product_slug);
    if (!kit) continue;
    const tile: KitTile = {
      slug: kit.slug,
      name: kit.name,
      tagline: kit.tagline,
      href: kit.href ?? null,
    };
    (l.status === "active" ? active : pending).push(tile);
  }
  return { active, pending };
}

/** True when the vendor has at least one active kit that is renderable (its slug
 *  is in KITS). Keeps the routing gate and the rendered tiles agreeing on what
 *  "active" means, so an active link to an unknown slug routes to pending rather
 *  than an empty dashboard. */
export function hasRenderableActiveKit(
  links: { product_slug: string; status: GrantStatus }[],
): boolean {
  return tilesForLinks(links).active.length > 0;
}

/** Read the signed-in user, team membership, and their own vendor_links (RLS
 *  scopes the rows to their email). Non-redirecting — callers decide routing. */
export async function loadVendorContext(): Promise<{
  user: User | null;
  isTeam: boolean;
  links: VendorLink[];
}> {
  const supabase = await createServerClient();
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return { user: null, isTeam: false, links: [] };
  }
  if (!user) return { user: null, isTeam: false, links: [] };

  const [teamRes, linksRes] = await Promise.all([
    supabase
      .from("merqo_team")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("vendor_links").select("product_slug, status"),
  ]);
  // A read error here is a config/grant fault (e.g. PGRST106 or a missing grant),
  // NOT "no kits" — surface it loudly rather than silently emptying the dashboard.
  if (teamRes.error)
    throw new Error(`merqo_team read failed: ${teamRes.error.message}`);
  if (linksRes.error)
    throw new Error(`vendor_links read failed: ${linksRes.error.message}`);

  return {
    user,
    isTeam: !!teamRes.data,
    links: (linksRes.data ?? []) as VendorLink[],
  };
}

/** Gate a /dashboard page on active-vendor access. Mirrors requireMerqoTeam. */
export async function requireActiveVendor(): Promise<{
  user: User;
  links: VendorLink[];
}> {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  const dest = resolveHome({
    isTeam,
    hasActiveKit: hasRenderableActiveKit(links),
  });
  if (dest !== "/dashboard") redirect(dest);
  return { user, links };
}
