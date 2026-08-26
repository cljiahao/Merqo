import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireMerqoTeamMock,
  addTeamMemberByEmailMock,
  removeTeamMemberMock,
  recordAuditMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireMerqoTeamMock: vi.fn(),
  addTeamMemberByEmailMock: vi.fn(),
  removeTeamMemberMock: vi.fn(),
  recordAuditMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));
vi.mock("@/lib/admin", () => ({
  addTeamMemberByEmail: addTeamMemberByEmailMock,
  removeTeamMember: removeTeamMemberMock,
  recordAudit: recordAuditMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { addTeamMemberAction, removeTeamMemberAction } from "./actions";
import { ADD_TEAM_IDLE } from "./state";

describe("addTeamMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("adds the member and records an audit row keyed to their user id", async () => {
    addTeamMemberByEmailMock.mockResolvedValue("new-user-1");
    const fd = new FormData();
    fd.set("email", "new@merqo.io");

    const res = await addTeamMemberAction(ADD_TEAM_IDLE, fd);

    expect(res).toEqual({
      status: "success",
      message: "Added new@merqo.io to the team.",
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      "admin-1",
      "add_team_member",
      "new-user-1",
      { email: "new@merqo.io" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/team");
  });

  it("errors without recording audit when no account matches the email", async () => {
    addTeamMemberByEmailMock.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("email", "nobody@merqo.io");

    const res = await addTeamMemberAction(ADD_TEAM_IDLE, fd);

    expect(res.status).toBe("error");
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});

describe("removeTeamMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("removes the member and records an audit row", async () => {
    removeTeamMemberMock.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.set("user_id", "member-1");

    const res = await removeTeamMemberAction(fd);

    expect(res).toEqual({ success: true });
    expect(recordAuditMock).toHaveBeenCalledWith(
      "admin-1",
      "remove_team_member",
      "member-1",
      null,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/team");
  });

  it("refuses to remove yourself, without recording audit", async () => {
    const fd = new FormData();
    fd.set("user_id", "admin-1");

    const res = await removeTeamMemberAction(fd);

    expect(res).toEqual({
      success: false,
      error: "You can't remove yourself.",
    });
    expect(removeTeamMemberMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});
