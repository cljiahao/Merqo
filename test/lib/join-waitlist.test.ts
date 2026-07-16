import { describe, it, expect, vi, afterEach } from "vitest";

const { addToWaitlistMock } = vi.hoisted(() => ({
  addToWaitlistMock: vi.fn(),
}));
vi.mock("@/lib/waitlist", () => ({ addToWaitlist: addToWaitlistMock }));

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { joinWaitlistAction } from "@/app/actions/join-waitlist";

afterEach(() => vi.clearAllMocks());

describe("joinWaitlistAction", () => {
  it("rejects a slug that isn't waitlistable", async () => {
    const res = await joinWaitlistAction("qkit");
    expect(res).toEqual({
      success: false,
      error: "This kit isn't open for waitlist yet.",
    });
    expect(addToWaitlistMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await joinWaitlistAction("shopkit");
    expect(res).toEqual({ success: false, error: "Sign in first." });
  });

  it("adds the signed-in user's email to the waitlist on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "vendor@example.com" } },
    });
    const res = await joinWaitlistAction("shopkit");
    expect(addToWaitlistMock).toHaveBeenCalledWith(
      "vendor@example.com",
      "shopkit",
    );
    expect(res).toEqual({ success: true });
  });

  it("returns a friendly error when the write throws", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "vendor@example.com" } },
    });
    addToWaitlistMock.mockRejectedValue(new Error("db down"));
    const res = await joinWaitlistAction("shopkit");
    expect(res).toEqual({
      success: false,
      error: "Couldn't join the waitlist. Try again.",
    });
  });
});
