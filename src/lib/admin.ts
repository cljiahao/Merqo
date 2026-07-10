import { createServiceClient } from "@/lib/supabase/server";

// All writes here run through the service client (bypasses RLS). Every caller
// MUST gate with requireMerqoTeam() first — these helpers do not re-check.

export type GrantStatus = "active" | "waitlist";

export type VendorGrant = {
  email: string;
  kits: { slug: string; name: string; status: GrantStatus }[];
};

type LinkRow = { email: string; product_slug: string; status: GrantStatus };

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

/** One vendor's grants by email, or null. Gate callers with requireMerqoTeam(). */
export async function getVendorGrant(
  email: string,
): Promise<VendorGrant | null> {
  const grants = await listVendorGrants();
  return findVendorGrant(grants, email);
}

export async function listVendorGrants(): Promise<VendorGrant[]> {
  const supabase = await createServiceClient();
  const [linksRes, productsRes] = await Promise.all([
    supabase.from("vendor_links").select("email, product_slug, status"),
    supabase.from("products").select("slug, name"),
  ]);
  if (linksRes.error) throw new Error(`links read: ${linksRes.error.message}`);
  if (productsRes.error)
    throw new Error(`products read: ${productsRes.error.message}`);
  const nameBySlug = new Map(
    (productsRes.data ?? []).map((p) => [p.slug, p.name]),
  );
  return groupVendorGrants((linksRes.data ?? []) as LinkRow[], nameBySlug);
}

export type ProductOption = { slug: string; name: string };

export async function listProducts(): Promise<ProductOption[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name")
    .order("created_at");
  if (error) throw new Error(`products read: ${error.message}`);
  return (data ?? []) as ProductOption[];
}

export type TeamMember = { user_id: string; email: string | null };

export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createServiceClient();
  const teamRes = await supabase.from("merqo_team").select("user_id");
  if (teamRes.error) throw new Error(`team read: ${teamRes.error.message}`);
  // Resolve emails via the admin API (merqo_team stores only auth user ids).
  const { data: usersData } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email]),
  );
  return (teamRes.data ?? [])
    .map((r) => ({
      user_id: r.user_id,
      email: emailById.get(r.user_id) ?? null,
    }))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

// ── Writes ────────────────────────────────────────────────────────────────

/** Grant a vendor active access to a kit (creates the link if absent). */
export async function grantKit(email: string, slug: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("vendor_links")
    .upsert(
      { email: email.toLowerCase(), product_slug: slug, status: "active" },
      { onConflict: "email,product_slug" },
    );
  if (error) throw new Error(`grant: ${error.message}`);
}

/** Remove a vendor's link to a kit entirely (revoke access + waitlist). */
export async function revokeKit(email: string, slug: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("vendor_links")
    .delete()
    .eq("email", email.toLowerCase())
    .eq("product_slug", slug);
  if (error) throw new Error(`revoke: ${error.message}`);
}

/**
 * Add a Merqo-team member by email. The person must already have an auth
 * account (signed in once) — we resolve email → user id via the admin API.
 * Returns false if no account matches that email.
 */
export async function addTeamMemberByEmail(email: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const key = email.toLowerCase();
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = (data?.users ?? []).find((u) => u.email?.toLowerCase() === key);
  if (!user) return false;
  const { error } = await supabase
    .from("merqo_team")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (error) throw new Error(`add team: ${error.message}`);
  return true;
}

export async function removeTeamMember(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("merqo_team")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`remove team: ${error.message}`);
}
