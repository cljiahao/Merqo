import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export type CatalogEntry = {
  slug: string;
  name: string;
  status: "coming_soon" | "live";
  app_url: string | null;
  owned: "active" | "waitlist" | null;
};

type ProductRow = {
  slug: string;
  name: string;
  status: "coming_soon" | "live";
  app_url: string | null;
};
type LinkRow = { product_slug: string; status: "active" | "waitlist" };

export function mergeCatalog(
  products: ProductRow[],
  links: LinkRow[],
): CatalogEntry[] {
  const bySlug = new Map(links.map((l) => [l.product_slug, l.status]));
  return products.map((p) => ({ ...p, owned: bySlug.get(p.slug) ?? null }));
}

export async function requireVendor(): Promise<{ user: User; email: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) notFound();
  // GoTrue stores emails lowercased; normalize so every downstream link lookup
  // matches regardless of the casing an email arrived in.
  return { user, email: user.email.toLowerCase() };
}

export async function resolveVendorCatalog(
  email: string,
): Promise<CatalogEntry[]> {
  const key = email.toLowerCase();
  const supabase = await createServiceClient();
  // Independent reads — fan out in parallel (one round-trip, not two).
  const [productsRes, linksRes] = await Promise.all([
    supabase
      .from("products")
      .select("slug, name, status, app_url")
      .order("created_at"),
    supabase
      .from("vendor_links")
      .select("product_slug, status")
      .eq("email", key),
  ]);
  if (productsRes.error)
    throw new Error(`products read: ${productsRes.error.message}`);
  if (linksRes.error) throw new Error(`links read: ${linksRes.error.message}`);
  return mergeCatalog(
    (productsRes.data ?? []) as ProductRow[],
    (linksRes.data ?? []) as LinkRow[],
  );
}

export async function addToWaitlist(
  email: string,
  productSlug: string,
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("vendor_links").upsert(
    {
      email: email.toLowerCase(),
      product_slug: productSlug,
      status: "waitlist",
    },
    { onConflict: "email,product_slug", ignoreDuplicates: true },
  );
  if (error) throw new Error(`waitlist upsert: ${error.message}`);
}
