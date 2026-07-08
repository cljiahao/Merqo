import { describe, it, expect, vi, beforeEach } from "vitest";

const { addToWaitlistMock } = vi.hoisted(() => ({
  addToWaitlistMock: vi.fn(),
}));
vi.mock("@/lib/waitlist", () => ({ addToWaitlist: addToWaitlistMock }));

import { joinKitWaitlist, WAITLIST_IDLE } from "@/app/actions/waitlist";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("joinKitWaitlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a normalized email for a valid coming kit and reports success", async () => {
    addToWaitlistMock.mockResolvedValue(undefined);
    const res = await joinKitWaitlist(
      WAITLIST_IDLE,
      form({ email: "  Vendor@Example.COM ", slug: "loopkit" }),
    );
    expect(addToWaitlistMock).toHaveBeenCalledWith(
      "vendor@example.com",
      "loopkit",
    );
    expect(res.status).toBe("success");
  });

  it("rejects an invalid email without touching the DB", async () => {
    const res = await joinKitWaitlist(
      WAITLIST_IDLE,
      form({ email: "not-an-email", slug: "loopkit" }),
    );
    expect(res.status).toBe("error");
    expect(addToWaitlistMock).not.toHaveBeenCalled();
  });

  it("rejects a slug that is not an open waitlist (e.g. live or planned kit)", async () => {
    const res = await joinKitWaitlist(
      WAITLIST_IDLE,
      form({ email: "v@x.com", slug: "qkit" }),
    );
    expect(res.status).toBe("error");
    expect(addToWaitlistMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the upsert throws", async () => {
    addToWaitlistMock.mockRejectedValue(new Error("db down"));
    const res = await joinKitWaitlist(
      WAITLIST_IDLE,
      form({ email: "v@x.com", slug: "loopkit" }),
    );
    expect(res.status).toBe("error");
    expect(res.message).toMatch(/try again/i);
  });
});
