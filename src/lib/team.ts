import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export async function requireMerqoTeam(): Promise<{ user: User }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data } = await supabase
    .from("merqo_team")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  return { user };
}
