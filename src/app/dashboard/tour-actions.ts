"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Mark the dashboard onboarding tour as seen for the current user, so it
 * stops auto-running on first login. Best-effort: this is cosmetic, so a
 * failure is logged but never surfaced — the worst case is the tour shows once
 * more. Upserts because a first-time viewer has no dashboard_prefs row yet;
 * RLS scopes the write to the caller's own row (user_id = auth.uid()).
 */
export async function markTourSeen(): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("dashboard_prefs")
    .upsert({ user_id: user.id, tour_seen_at: new Date().toISOString() });

  if (error) console.error("markTourSeen failed", error.message);
}
