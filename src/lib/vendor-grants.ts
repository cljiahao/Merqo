// No supabase/server import here on purpose — this file must stay safe to
// import from a client component (vendor-list.tsx does). See the equivalent
// comment in metrics-client.ts for why that boundary matters: pulling
// "next/headers" into a client bundle fails the Next.js build.

export type GrantStatus = "active" | "waitlist";

export type VendorGrant = {
  email: string;
  kits: { slug: string; name: string; status: GrantStatus }[];
};

export type ProductOption = { slug: string; name: string };

export type LinkRow = {
  email: string;
  product_slug: string;
  status: GrantStatus;
};

/** Group flat vendor_links rows into one entry per vendor email. Pure — tested. */
export function groupVendorGrants(
  links: LinkRow[],
  nameBySlug: Map<string, string>,
): VendorGrant[] {
  const byEmail = new Map<string, VendorGrant>();
  for (const l of links) {
    const entry = byEmail.get(l.email) ?? { email: l.email, kits: [] };
    entry.kits.push({
      slug: l.product_slug,
      name: nameBySlug.get(l.product_slug) ?? l.product_slug,
      status: l.status,
    });
    byEmail.set(l.email, entry);
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/** Find one vendor's grant entry by email (case-insensitive). Pure — tested. */
export function findVendorGrant(
  grants: VendorGrant[],
  email: string,
): VendorGrant | null {
  const key = email.toLowerCase();
  return grants.find((g) => g.email.toLowerCase() === key) ?? null;
}

/** Narrow the vendor list by email substring, kit status, and/or kit slug for
 *  the /admin/vendors search UI. When status and slug are both set, they must
 *  match the same kit entry (not just any two kits on the vendor). Pure — tested. */
export function filterVendorGrants(
  grants: VendorGrant[],
  filters: { query?: string; status?: GrantStatus | "all"; slug?: string },
): VendorGrant[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const status = filters.status ?? "all";
  const slug = filters.slug ?? "all";
  return grants.filter((g) => {
    if (query && !g.email.toLowerCase().includes(query)) return false;
    if (status === "all" && slug === "all") return true;
    return g.kits.some(
      (k) =>
        (slug === "all" || k.slug === slug) &&
        (status === "all" || k.status === status),
    );
  });
}
