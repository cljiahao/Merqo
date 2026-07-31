import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shape returned by merqo.get_or_create_vendor_profile /
 * merqo.upsert_vendor_profile (supabase/migrations/0009_vendor_profile.sql).
 * Merqo owns this table directly (its server client already defaults to the
 * `merqo` schema — see src/lib/supabase/server.ts) but has no generated
 * Database type today, so the RPC contract is hand-written here rather than
 * imported.
 */
export type VendorProfile = {
  vendor_id: string;
  stall_name: string;
  social_links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type MerqoSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_or_create_vendor_profile: {
        Args: { p_vendor_id: string; p_default_stall_name: string | null };
        Returns: VendorProfile;
      };
      upsert_vendor_profile: {
        Args: {
          p_vendor_id: string;
          p_stall_name: string;
          p_social_links: Record<string, string>;
        };
        Returns: VendorProfile;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Callers pass in whatever concrete client type their own module has (e.g.
 * `createServerClient()`'s inferred, untyped-Database return) — this file
 * must accept whatever that instantiation is. Declaring the functions
 * generic over the caller's own Database/SchemaName lets each call site's
 * concrete client type flow in unchanged; the body then re-asserts it
 * against MerqoSchema for the typed RPC call (the client already defaults
 * to the `merqo` schema at runtime — see server.ts's `db: { schema: "merqo" }`
 * — so no `.schema("merqo")` call is needed, only the type assertion).
 */
export async function getOrCreateVendorProfile<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  vendorId: string,
  defaultStallName: string | null,
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<
    MerqoSchema,
    "merqo"
  >;
  const { data, error } = await merqoClient.rpc(
    "get_or_create_vendor_profile",
    {
      p_vendor_id: vendorId,
      p_default_stall_name: defaultStallName,
    },
  );
  if (error) {
    throw new Error(`get_or_create_vendor_profile failed: ${error.message}`);
  }
  return data;
}

export async function upsertVendorProfile<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  vendorId: string,
  stallName: string,
  socialLinks: Record<string, string>,
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<
    MerqoSchema,
    "merqo"
  >;
  const { data, error } = await merqoClient.rpc("upsert_vendor_profile", {
    p_vendor_id: vendorId,
    p_stall_name: stallName,
    p_social_links: socialLinks,
  });
  if (error) {
    throw new Error(`upsert_vendor_profile failed: ${error.message}`);
  }
  return data;
}
