import { createServiceClient } from "@/lib/supabase/server";

export type OpenSupportMessage = {
  id: string;
  email: string | null;
  kit_slug: string | null;
  category: string;
  body: string;
  created_at: string;
};

/** Open support messages, oldest first, with the submitter's email resolved
 *  via the admin API (support_messages has no email column — same pattern
 *  as admin.ts's listTeamMembers). Gate callers with requireMerqoTeam().
 *  `category` is a plain string, not a fixed enum — since 2026-07-23 any
 *  kit can write its own category vocabulary through the shared
 *  submit_support_message RPC (see the cross-kit-support-messages design
 *  spec); this read model no longer assumes the hub's own 4 categories. */
export async function listOpenSupportMessages(): Promise<OpenSupportMessage[]> {
  const supabase = await createServiceClient();
  const [messagesRes, usersRes] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, user_id, kit_slug, category, body, created_at")
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
    kit_slug: m.kit_slug as string | null,
    category: m.category as string,
    body: m.body as string,
    created_at: m.created_at as string,
  }));
}
