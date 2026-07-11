import { describe, it, expect, vi, afterEach } from "vitest";

const { insertMock, fromMock, getUserMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const getUserMock = vi.fn();
  return { insertMock, fromMock, getUserMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { submitSupportMessageAction } from "@/app/actions/support";

afterEach(() => vi.clearAllMocks());

describe("submitSupportMessageAction", () => {
  it("rejects invalid input before touching Supabase", async () => {
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "",
    });
    expect(res.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({ success: false, error: "Please sign in first" });
  });

  it("inserts the message under the signed-in user's id on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(fromMock).toHaveBeenCalledWith("support_messages");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({ success: true });
  });

  it("returns a friendly error when the insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await submitSupportMessageAction({
      category: "billing",
      body: "help",
    });
    expect(res).toEqual({
      success: false,
      error: "Could not send your message",
    });
  });
});
