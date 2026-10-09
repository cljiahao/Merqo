import { readAdminRows, adminEmailsById } from "./admin-read";
import { createServiceClient } from "@/lib/supabase/server";
import {
  groupVendorGrants,
  findVendorGrant,
  filterVendorGrants,
} from "@/lib/vendor-grants";
import type {
  GrantStatus,
  VendorGrant,
  ProductOption,
  LinkRow,
} from "@/lib/vendor-grants";
import type { Json, AdminAudit } from "@/lib/types";

// All writes here run through the service client (bypasses RLS). Every caller
// MUST gate with requireMerqoTeam() first — these helpers do not re-check.

// Re-exported so existing call sites (server pages/actions) keep working —
// the pure logic itself lives in vendor-grants.ts, which client components
// import directly to avoid pulling this file's supabase/server dependency
// into a client bundle.
export type { GrantStatus, VendorGrant, ProductOption };
export { groupVendorGrants, findVendorGrant, filterVendorGrants };

/** One vendor's grants by email, or null. Gate callers with requireMerqoTeam(). */
export async function getVendorGrant(
  email: string,
): Promise<VendorGrant | null> {
  const grants = await loadVendorGrants(email.toLowerCase());
  return findVendorGrant(grants, email);
}

export async function listVendorGrants(): Promise<VendorGrant[]> {
  return loadVendorGrants();
}

async function loadVendorGrants(email?: string): Promise<VendorGrant[]> {
  const supabase = await createServiceClient();
  const [links, products] = await Promise.all([
    readAdminRows("links read", (from, to) => {
      let query = supabase
        .from("vendor_links")
        .select("email, product_slug, status");
      if (email !== undefined) query = query.eq("email", email);
      return query.order("email").order("product_slug").range(from, to);
    }),
    readAdminRows("products read", (from, to) =>
      supabase
        .from("products")
        .select("slug, name")
        .order("slug")
        .range(from, to),
    ),
  ]);
  const nameBySlug = new Map(products.map((p) => [p.slug, p.name]));
  return groupVendorGrants(links as LinkRow[], nameBySlug);
}

export async function listProducts(): Promise<ProductOption[]> {
  const supabase = await createServiceClient();
  return readAdminRows("products read", (from, to) =>
    supabase
      .from("products")
      .select("slug, name")
      .order("created_at")
      .order("slug")
      .range(from, to),
  );
}

export type TeamMember = { user_id: string; email: string | null };

// listUsers() is paginated; a single call only returns page 1. Past 1000 auth
// users, an unpaginated read silently drops real accounts.
async function listAllAuthUsers(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
) {
  const perPage = 1000;
  const users: { id: string; email?: string | null }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`list users: ${error.message}`);
    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < perPage) break;
  }
  return users;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createServiceClient();
  const team = await readAdminRows("team read", (from, to) =>
    supabase
      .from("merqo_team")
      .select("user_id")
      .order("user_id")
      .range(from, to),
  );
  const emailById = await adminEmailsById(
    supabase,
    team.map((row) => row.user_id),
  );
  return team
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
 * Returns the added member's user id, or null if no account matches that
 * email.
 */
export async function addTeamMemberByEmail(
  email: string,
): Promise<string | null> {
  const supabase = await createServiceClient();
  const key = email.toLowerCase();
  const users = await listAllAuthUsers(supabase);
  const user = users.find((u) => u.email?.toLowerCase() === key);
  if (!user) return null;
  const { error } = await supabase
    .from("merqo_team")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (error) throw new Error(`add team: ${error.message}`);
  return user.id;
}

export async function removeTeamMember(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("merqo_team")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`remove team: ${error.message}`);
}

// ── Audit trail ──────────────────────────────────────────────────────────

/**
 * Append an admin-audit row. Best-effort: a hiccup here must not fail the
 * action it records, but it's logged so a broken trail stays visible. Every
 * real mutating admin action in this console calls this after its write
 * succeeds — see src/app/admin/actions.ts, vendors/actions.ts, and
 * team/actions.ts.
 */
export async function recordAudit(
  adminId: string,
  action: string,
  targetId: string | null,
  detail: Json,
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("admin_audit").insert({
      admin_id: adminId,
      action,
      target_id: targetId,
      detail,
    });
    if (error) console.error("admin_audit insert failed", error.message);
  } catch {
    console.error("admin_audit unavailable");
  }
}

export type AdminAuditEntry = AdminAudit & { adminEmail: string };

/**
 * Recent admin_audit rows, most recent first, with `admin_id` resolved to an
 * email where possible (falls back to the raw id). Gate callers with
 * requireMerqoTeam().
 */
export async function listAdminAuditEntries(
  limit = 100,
): Promise<AdminAuditEntry[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("admin_audit")
    .select("id, admin_id, action, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`admin_audit read: ${error.message}`);
  const rows = (data ?? []) as AdminAudit[];
  const emailById = await adminEmailsById(
    supabase,
    rows.map((row) => row.admin_id),
  );
  return rows.map((r) => ({
    ...r,
    adminEmail: emailById.get(r.admin_id) ?? r.admin_id,
  }));
}
