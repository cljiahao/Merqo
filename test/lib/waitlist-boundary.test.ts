import { beforeEach, expect, it, vi } from "vitest";
const upsert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from: () => ({ upsert }) }),
}));
import { addToWaitlist } from "@/lib/waitlist";
beforeEach(() => upsert.mockReset());
it("normalizes identity and preserves an existing active grant", async () => {
  upsert.mockResolvedValue({ error: null });
  await addToWaitlist("Vendor@Example.com", "qkit");
  expect(upsert).toHaveBeenCalledWith(
    { email: "vendor@example.com", product_slug: "qkit", status: "waitlist" },
    { onConflict: "email,product_slug", ignoreDuplicates: true },
  );
});
it("surfaces failed writes instead of reporting successful enrollment", async () => {
  upsert.mockResolvedValue({ error: { message: "database unavailable" } });
  await expect(addToWaitlist("vendor@example.com", "qkit")).rejects.toThrow(
    "waitlist upsert",
  );
});
