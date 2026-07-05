import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export async function requireMerqoTeam(): Promise<{ user: User }> {
  const supabase = await createServerClient();
  let user: User | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    // Transient auth outage — degrade to unauthorized rather than 500,
    // mirroring the graceful path in middleware.ts.
    notFound();
  }
  if (!user) notFound();
  const { data } = await supabase
    .from("merqo_team")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  return { user };
}
