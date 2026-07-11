"use server";
import { createServerClient } from "@/lib/supabase/server";
import {
  supportMessageSchema,
  type SupportMessageInput,
} from "@/lib/feedback-support-schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * File a hub-level help request for the Merqo team to action in /admin — no
 * email. Inserted via the session client (not service-role): the
 * support_messages_self_insert RLS policy is the authorization boundary
 * here, mirroring qkit's own submitSupportMessage.
 */
export async function submitSupportMessageAction(
  input: SupportMessageInput,
): Promise<ActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  const { error } = await supabase.from("support_messages").insert({
    user_id: user.id,
    category: parsed.data.category,
    body: parsed.data.body,
  });
  if (error) {
    console.error("submitSupportMessageAction failed", error.message);
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}
