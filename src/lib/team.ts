import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Gate an operator page on Merqo-team membership. A missing session bounces to
 * /login; a signed-in non-member lands on /no-access (a clear "not on the team
 * yet" screen) rather than a raw 404, so the operator knows what happened.
 */
export async function requireMerqoTeam(): Promise<{ user: User }> {
  const supabase = await createServerClient();
  let user: User | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    // Transient auth outage — degrade to signed-out rather than 500.
    redirect("/login");
  }
  if (!user) redirect("/login");
  const { data, error } = await supabase
    .from("merqo_team")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // A query error (e.g. the `merqo` schema isn't exposed → PGRST106, or the
  // migration/grants are missing) is a config fault, NOT "not a member". Surface
  // it loudly instead of silently bouncing a real member to /no-access.
  if (error) throw new Error(`merqo_team read failed: ${error.message}`);
  if (!data) redirect("/no-access");
  return { user };
}
