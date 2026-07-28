import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";

export type RegistryRow = {
  slug: string;
  name: string;
  app_url: string | null;
  metrics_url: string | null;
  metrics_secret: string | null;
  provision_secret: string | null;
};

// Wrapped in React's request-scoped cache() — a page and the syncVendorKits()/
// provisionVendorKits() it also calls each ask for the live registry, and
// without this they'd hit merqo.products twice per render.
export const listLiveProducts = cache(async (): Promise<RegistryRow[]> => {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, name, app_url, metrics_url, metrics_secret, provision_secret",
    )
    .eq("status", "live");
  if (error) throw new Error(`products read failed: ${error.message}`);
  return (data ?? []) as RegistryRow[];
});
