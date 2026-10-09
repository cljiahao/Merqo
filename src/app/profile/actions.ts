"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { patchVendorProfile } from "@/lib/merqo-vendor-profile";
import {
  profileNameSchema,
  socialLinksSchema,
  type ProfileNameInput,
  type SocialLinksInput,
} from "@/lib/schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * Update the vendor's stall name in the shared merqo.vendor_profile table
 * via the field-specific patch_vendor_profile
 * RPC — every kit reads/writes this one copy.
 */
export async function updateStallName(
  input: ProfileNameInput,
): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid stall name",
    };

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Not signed in" };

  try {
    await patchVendorProfile(supabase, user.id, {
      stallName: parsed.data.name,
    });
  } catch (err) {
    console.error(
      "updateStallName failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not save stall name" };
  }

  // Refresh the dashboard/admin layouts so the header/account menu pick up
  // the new name.
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Update the vendor's profile-level social/website links. Same
 * merqo.vendor_profile write path as updateStallName.
 */
export async function updateSocialLinks(
  input: SocialLinksInput,
): Promise<ActionResult> {
  const parsed = socialLinksSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid links",
    };

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Not signed in" };

  try {
    await patchVendorProfile(supabase, user.id, { socialLinks: parsed.data });
  } catch (err) {
    console.error(
      "updateSocialLinks failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not save links" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
