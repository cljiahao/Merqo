import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireVendorMock, addToWaitlistMock, revalidateMock } = vi.hoisted(
  () => ({
    requireVendorMock: vi.fn(),
    addToWaitlistMock: vi.fn(),
    revalidateMock: vi.fn(),
  }),
);
vi.mock("@/lib/vendor", () => ({
  requireVendor: requireVendorMock,
  addToWaitlist: addToWaitlistMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

import { joinWaitlistAction } from "@/app/(vendor)/products/actions";

describe("joinWaitlistAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireVendorMock.mockResolvedValue({
      user: { id: "u" },
      email: "v@x.com",
    });
  });

  it("adds the vendor's email to the product waitlist and revalidates", async () => {
    const fd = new FormData();
    fd.set("product_slug", "loopkit");
    await joinWaitlistAction(fd);
    expect(addToWaitlistMock).toHaveBeenCalledWith("v@x.com", "loopkit");
    expect(revalidateMock).toHaveBeenCalledWith("/products");
  });

  it("throws on a missing product_slug", async () => {
    await expect(joinWaitlistAction(new FormData())).rejects.toThrow();
    expect(addToWaitlistMock).not.toHaveBeenCalled();
  });
});
