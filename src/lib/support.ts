import { createServiceClient } from "@/lib/supabase/server";
import type { SupportMessageInput } from "@/lib/feedback-support-schemas";

export type OpenSupportMessage = {
  id: string;
  email: string | null;
  category: SupportMessageInput["category"];
  body: string;
  created_at: string;
};

/** Open support messages, oldest first, with the submitter's email resolved
 *  via the admin API (support_messages has no email column — same pattern
 *  as admin.ts's listTeamMembers). Gate callers with requireMerqoTeam(). */
export async function listOpenSupportMessages(): Promise<OpenSupportMessage[]> {
  const supabase = await createServiceClient();
  const [messagesRes, usersRes] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, user_id, category, body, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (messagesRes.error) {
    throw new Error(`support messages read: ${messagesRes.error.message}`);
  }
  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );
  return (messagesRes.data ?? []).map((m) => ({
    id: m.id as string,
    email: emailById.get(m.user_id as string) ?? null,
    category: m.category as SupportMessageInput["category"],
    body: m.body as string,
    created_at: m.created_at as string,
  }));
}
