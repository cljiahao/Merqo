import { z } from "zod";

export const supportMessageSchema = z.object({
  category: z.enum(["vendor_access", "billing", "team", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  vendor_access: "Vendor access",
  billing: "Billing",
  team: "Team",
  other: "Something else",
};

export const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
