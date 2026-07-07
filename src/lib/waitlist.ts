import { createServiceClient } from "@/lib/supabase/server";

/**
 * Add an email to a kit's waitlist. Used by the public landing waitlist form —
 * merqo has no vendor self-serve surface, so this is the only waitlist writer.
 */
export async function addToWaitlist(
  email: string,
  productSlug: string,
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("vendor_links").upsert(
    {
      email: email.toLowerCase(),
      product_slug: productSlug,
      status: "waitlist",
    },
    { onConflict: "email,product_slug", ignoreDuplicates: true },
  );
  if (error) throw new Error(`waitlist upsert: ${error.message}`);
}
