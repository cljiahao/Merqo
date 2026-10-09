import { createServerClient } from "@/lib/supabase/server";

type DashboardSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

/** Idempotent cosmetic stamp. RLS restricts ownership; failures must not break navigation. */
export async function stampTourSeen(
  supabase: DashboardSupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("dashboard_prefs")
      .upsert({ user_id: userId, tour_seen_at: new Date().toISOString() });
    if (error) console.error("markTourSeen failed", error.message);
  } catch {
    console.error("markTourSeen unavailable");
  }
}
