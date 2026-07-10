import { createServiceClient } from "@/lib/supabase/server";

/**
 * Add an email to a kit's waitlist. Called by both the public landing
 * waitlist form (unauthenticated — email typed into the form) and the
 * signed-in dashboard's "Join waitlist" button (email comes from the
 * session, see src/app/actions/join-waitlist.ts).
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
