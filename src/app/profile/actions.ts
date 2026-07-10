"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export async function updateDisplayNameAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { success: false, error: "Enter a name (1-80 characters)." };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.displayName },
  });
  if (error) {
    return { success: false, error: "Couldn't update your name. Try again." };
  }
  return { success: true };
}
