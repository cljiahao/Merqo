"use server";
import { z } from "zod";
import { addToWaitlist } from "@/lib/waitlist";
import { WAITLISTABLE_SLUGS } from "@/lib/kits";

/** Public landing waitlist. Email comes from the form (no auth) — this is the
 *  only waitlist entry point now that vendors have no self-serve surface. */
const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  slug: z.enum(WAITLISTABLE_SLUGS as [string, ...string[]]),
});

export type WaitlistState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const WAITLIST_IDLE: WaitlistState = { status: "idle" };

export async function joinKitWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  try {
    await addToWaitlist(parsed.data.email, parsed.data.slug);
    return {
      status: "success",
      message: "You're on the list — we'll email you when it opens.",
    };
  } catch {
    return {
      status: "error",
      message: "Something went wrong. Try again in a moment.",
    };
  }
}
