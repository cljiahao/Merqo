"use server";
import { createServerClient } from "@/lib/supabase/server";
import {
  feedbackSchema,
  type FeedbackInput,
} from "@/lib/feedback-support-schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * Submit hub-level Merqo feedback (NPS + optional comment). Inserted via the
 * session client — the feedback_self_insert RLS policy is the authorization
 * boundary, mirroring submitSupportMessageAction.
 */
export async function submitFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    nps: parsed.data.nps,
    message: parsed.data.message ?? null,
  });
  if (error) {
    console.error("submitFeedbackAction failed", error.message);
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}
