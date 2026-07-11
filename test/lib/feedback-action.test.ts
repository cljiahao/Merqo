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

import { submitFeedbackAction } from "@/app/actions/feedback";

afterEach(() => vi.clearAllMocks());

describe("submitFeedbackAction", () => {
  it("rejects invalid input before touching Supabase", async () => {
    const res = await submitFeedbackAction({ nps: 11 });
    expect(res.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await submitFeedbackAction({ nps: 8 });
    expect(res).toEqual({ success: false, error: "Please sign in first" });
  });

  it("inserts the score under the signed-in user's id on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    const res = await submitFeedbackAction({ nps: 8, message: "Great!" });
    expect(fromMock).toHaveBeenCalledWith("feedback");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      nps: 8,
      message: "Great!",
    });
    expect(res).toEqual({ success: true });
  });

  it("inserts a null message when none was provided", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    await submitFeedbackAction({ nps: 8 });
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      nps: 8,
      message: null,
    });
  });

  it("returns a friendly error when the insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await submitFeedbackAction({ nps: 8 });
    expect(res).toEqual({ success: false, error: "Could not send feedback" });
  });
});
