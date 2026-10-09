"use server";

import { createServerClient } from "@/lib/supabase/server";
import { stampTourSeen } from "@/lib/tour-prefs";

/** Supplements the server layout stamp when the tour starts in the browser. */
export async function markTourSeen(): Promise<void> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return;
    await stampTourSeen(supabase, user.id);
  } catch {
    console.error("markTourSeen unavailable");
  }
}
