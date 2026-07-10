import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { KITS, type Kit } from "@/lib/kits";
import type { GrantStatus } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

export type HomeDestination = "/admin" | "/dashboard" | "/dashboard/pending";

export type KitTile = {
  slug: string;
  name: string;
  tagline: string;
  href: string | null;
  /** Only meaningful on an active tile — the tier the kit last reported. */
  plan?: string | null;
};

export type VendorLink = {
  product_slug: string;
  status: GrantStatus;
  plan: string | null;
};

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

/** Where `requireActiveVendor` redirects AWAY to when the signed-in user
 *  has no active kit. Unlike resolveHome (which always sends a team member
 *  to /admin as the post-login default), this only blocks /dashboard for
 *  the absence of an active kit — a dual-role account (team + active kit)
 *  is never blocked here, even though resolveHome would still land them on
 *  /admin fresh from login. */
export function dashboardGateDestination(
  isTeam: boolean,
  hasActiveKit: boolean,
): HomeDestination {
  if (hasActiveKit) return "/dashboard";
  return isTeam ? "/admin" : "/dashboard/pending";
}

/** Map a vendor's link rows onto display tiles via the static KITS config.
 *  KITS is the display allow-list — an unknown slug is dropped, not rendered. */
export function tilesForLinks(
  links: {
    product_slug: string;
    status: GrantStatus;
    plan?: string | null;
  }[],
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
      plan: l.status === "active" ? l.plan : undefined,
    };
    (l.status === "active" ? active : pending).push(tile);
  }
  return { active, pending };
}

/** Live kits the vendor has no vendor_links row for at all (not active, not
 *  waitlist) — the "you haven't joined this yet" set for the self-serve
 *  add-a-kit section. Pure — tested. */
export function addableKits(
  links: { product_slug: string }[],
  kits: Kit[] = KITS,
): KitTile[] {
  const linked = new Set(links.map((l) => l.product_slug));
  return kits
    .filter((k) => k.status === "live" && !linked.has(k.slug))
    .map((k) => ({
      slug: k.slug,
      name: k.name,
      tagline: k.tagline,
      href: k.href ?? null,
    }));
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

/** True when the vendor has an active link to this specific kit slug — the
 *  one-slug version of hasRenderableActiveKit, used to gate the self-serve
 *  upgrade-request action so it can't be invoked for a kit the vendor
 *  doesn't actually use. Pure — tested. */
export function hasActiveLinkFor(
  links: { product_slug: string; status: GrantStatus }[],
  slug: string,
): boolean {
  return links.some((l) => l.product_slug === slug && l.status === "active");
}

/** Read the signed-in user, team membership, and their own vendor_links.
 *  Explicitly filtered by email — RLS on vendor_links additionally grants
 *  team members read access to EVERY vendor's rows (so admin pages can
 *  browse all vendors), so relying on RLS alone here would leak every
 *  vendor's links into a team caller's "own kits" view. Non-redirecting —
 *  callers decide routing. */
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

  const linksQuery = user.email
    ? supabase
        .from("vendor_links")
        .select("product_slug, status, plan")
        .eq("email", user.email.toLowerCase())
    : null;

  const [teamRes, linksRes] = await Promise.all([
    supabase
      .from("merqo_team")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    linksQuery ?? Promise.resolve({ data: [] as VendorLink[], error: null }),
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

/** Gate a /dashboard page on active-vendor access. Also returns isTeam so
 *  callers (the dashboard layout) can offer a switch link to /admin for
 *  dual-role accounts. */
export async function requireActiveVendor(): Promise<{
  user: User;
  links: VendorLink[];
  isTeam: boolean;
}> {
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) redirect("/login");
  const dest = dashboardGateDestination(isTeam, hasRenderableActiveKit(links));
  if (dest !== "/dashboard") redirect(dest);
  return { user, links, isTeam };
}

/** Whether this email has any active vendor kit — used only by the admin
 *  layout (already holding the signed-in user's email via requireMerqoTeam)
 *  to decide whether to show a "view vendor dashboard" switch link.
 *  Explicitly filters by email rather than relying on RLS alone: the
 *  vendor_links_own_select policy also grants team members read access to
 *  EVERY vendor's rows (so they can administer them elsewhere), so an
 *  unfiltered read here would show the switch link to any team member, not
 *  just one who genuinely also holds an active kit themselves. Best-effort:
 *  a read error hides the link rather than breaking the whole /admin page
 *  over a decorative affordance. */
export async function hasActiveVendorAccess(email: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("vendor_links")
    .select("product_slug, status")
    .eq("email", email.toLowerCase());
  if (error) return false;
  return hasRenderableActiveKit((data ?? []) as VendorLink[]);
}
