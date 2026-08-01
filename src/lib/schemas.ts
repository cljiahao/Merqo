import { z } from "zod";

// ── Social/website links ─────────────────────────────────────────────────────
// Shared merqo.vendor_profile.social_links. All fields optional; an
// absent/empty object means "nothing set".

const socialUrl = z
  .string()
  .trim()
  .max(300)
  .refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) link")
  .optional();

export const socialLinksSchema = z.object({
  website: socialUrl,
  instagram: socialUrl,
  facebook: socialUrl,
  tiktok: socialUrl,
});
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

// ── Profile page ──────────────────────────────────────────────────────────────

export const profileNameSchema = z.object({
  name: z.string().min(1, "Stall name is required").max(100),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

// Personal display name on the auth user (user_metadata.display_name).
// Optional: an empty string clears it. Trimmed so trailing whitespace can't
// slip past max.
export const displayNameSchema = z.object({
  displayName: z.string().trim().max(60, "Display name is too long"),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;

// New password + confirm. Min length mirrors the login schema (8); confirm
// must match.
export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
