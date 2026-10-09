import { readAdminRows, adminEmailsById } from "./admin-read";
import { createServiceClient } from "@/lib/supabase/server";

export type OpenSupportMessage = {
  id: string;
  email: string | null;
  kit_slug: string | null;
  category: string;
  body: string;
  created_at: string;
};

/** Complete open inbox with sender emails. Callers must require Merqo team access. */
export async function listOpenSupportMessages(): Promise<OpenSupportMessage[]> {
  const supabase = await createServiceClient();
  const messages = await readAdminRows("support messages read", (from, to) =>
    supabase
      .from("support_messages")
      .select("id, user_id, kit_slug, category, body, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
  );
  const emailById = await adminEmailsById(
    supabase,
    messages.map((message) => message.user_id),
  );
  return messages.map((m) => ({
    id: m.id as string,
    email: emailById.get(m.user_id as string) ?? null,
    kit_slug: m.kit_slug as string | null,
    category: m.category as string,
    body: m.body as string,
    created_at: m.created_at as string,
  }));
}
