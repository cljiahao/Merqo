"use server";
import { revalidatePath } from "next/cache";
import { requireVendor, addToWaitlist } from "@/lib/vendor";

export async function joinWaitlistAction(formData: FormData): Promise<void> {
  const slug = formData.get("product_slug");
  if (typeof slug !== "string" || slug.length === 0) {
    throw new Error("product_slug is required");
  }
  const { email } = await requireVendor();
  await addToWaitlist(email, slug);
  revalidatePath("/products");
}
