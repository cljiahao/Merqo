import { describe, it, expect, vi, afterEach } from "vitest";

const { requireMerqoTeamMock, eqMock, updateMock, fromMock, recordAuditMock } =
  vi.hoisted(() => {
    const eqMock = vi.fn();
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const requireMerqoTeamMock = vi.fn();
    const recordAuditMock = vi.fn();
    return {
      requireMerqoTeamMock,
      eqMock,
      updateMock,
      fromMock,
      recordAuditMock,
    };
  });

vi.mock("@/lib/team", () => ({ requireMerqoTeam: requireMerqoTeamMock }));
vi.mock("@/lib/admin", () => ({ recordAudit: recordAuditMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from: fromMock }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { resolveSupportMessageAction } from "@/app/admin/actions";

afterEach(() => vi.clearAllMocks());

describe("resolveSupportMessageAction", () => {
  it("requires team membership before touching the database", async () => {
    requireMerqoTeamMock.mockRejectedValue(new Error("not team"));
    await expect(resolveSupportMessageAction("m1")).rejects.toThrow();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updates the message status to resolved on success", async () => {
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
    eqMock.mockResolvedValue({ error: null });
    const res = await resolveSupportMessageAction("m1");
    expect(fromMock).toHaveBeenCalledWith("support_messages");
    expect(updateMock).toHaveBeenCalledWith({ status: "resolved" });
    expect(eqMock).toHaveBeenCalledWith("id", "m1");
    expect(res).toEqual({ success: true });
    expect(recordAuditMock).toHaveBeenCalledWith(
      "u1",
      "resolve_support_message",
      "m1",
      null,
    );
  });

  it("returns a friendly error when the update fails", async () => {
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
    eqMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await resolveSupportMessageAction("m1");
    expect(res).toEqual({ success: false, error: "Could not resolve" });
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});
