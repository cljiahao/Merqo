import { createServiceClient } from "@/lib/supabase/server";

export type RegistryRow = {
  slug: string;
  name: string;
  app_url: string | null;
  metrics_url: string | null;
  metrics_secret: string | null;
};

export async function listLiveProducts(): Promise<RegistryRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name, app_url, metrics_url, metrics_secret")
    .eq("status", "live");
  if (error) throw new Error(`products read failed: ${error.message}`);
  return (data ?? []) as RegistryRow[];
}
