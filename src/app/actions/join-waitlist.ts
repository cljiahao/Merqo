"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { addToWaitlist } from "@/lib/waitlist";
import { WAITLISTABLE_SLUGS } from "@/lib/kits";
import type { ActionResult } from "@/lib/action-result";

/** Signed-in vendor joins a coming-soon kit's waitlist from /dashboard — no
 *  email field needed (unlike the public landing WaitlistForm), since the
 *  vendor is already authenticated. */
export async function joinWaitlistAction(slug: string): Promise<ActionResult> {
  if (!WAITLISTABLE_SLUGS.includes(slug)) {
    return { success: false, error: "This kit isn't open for waitlist yet." };
  }
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { success: false, error: "Sign in first." };
  try {
    await addToWaitlist(email, slug);
  } catch {
    return { success: false, error: "Couldn't join the waitlist. Try again." };
  }
  revalidatePath("/dashboard");
  return { success: true };
}
