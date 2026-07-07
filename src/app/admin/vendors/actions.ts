"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { grantKit, revokeKit } from "@/lib/admin";
import type { ActionResult } from "@/lib/action-result";

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  slug: z.string().trim().min(1),
});

export async function grantKitAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireMerqoTeam();
  const parsed = grantSchema.safeParse({
    email: formData.get("email"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email and kit." };
  }
  try {
    await grantKit(parsed.data.email, parsed.data.slug);
  } catch {
    return { success: false, error: "Couldn't grant access. Try again." };
  }
  revalidatePath("/admin/vendors");
  return { success: true };
}

export async function revokeKitAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireMerqoTeam();
  const parsed = grantSchema.safeParse({
    email: formData.get("email"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email and kit." };
  }
  try {
    await revokeKit(parsed.data.email, parsed.data.slug);
  } catch {
    return { success: false, error: "Couldn't revoke access. Try again." };
  }
  revalidatePath("/admin/vendors");
  return { success: true };
}
