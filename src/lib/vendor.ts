import { KITS } from "@/lib/kits";
import type { GrantStatus } from "@/lib/admin";

export type HomeDestination = "/admin" | "/dashboard" | "/dashboard/pending";

export type KitTile = {
  slug: string;
  name: string;
  tagline: string;
  href: string | null;
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
