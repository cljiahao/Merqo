"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { grantKit, revokeKit } from "@/lib/admin";

const emailSchema = z.string().trim().toLowerCase().email();
const slugSchema = z.string().trim().min(1);

export async function grantKitAction(formData: FormData): Promise<void> {
  await requireMerqoTeam();
  const email = emailSchema.parse(formData.get("email"));
  const slug = slugSchema.parse(formData.get("slug"));
  await grantKit(email, slug);
  revalidatePath("/vendors");
}

export async function revokeKitAction(formData: FormData): Promise<void> {
  await requireMerqoTeam();
  const email = emailSchema.parse(formData.get("email"));
  const slug = slugSchema.parse(formData.get("slug"));
  await revokeKit(email, slug);
  revalidatePath("/vendors");
}
