import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireMerqoTeamMock,
  grantKitMock,
  revokeKitMock,
  recordAuditMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireMerqoTeamMock: vi.fn(),
  grantKitMock: vi.fn(),
  revokeKitMock: vi.fn(),
  recordAuditMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));
vi.mock("@/lib/admin", () => ({
  grantKit: grantKitMock,
  revokeKit: revokeKitMock,
  recordAudit: recordAuditMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { grantKitAction, revokeKitAction } from "./actions";

function formData(email: string, slug: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("slug", slug);
  return fd;
}

describe("grantKitAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("grants access and records an audit row", async () => {
    grantKitMock.mockResolvedValue(undefined);

    const res = await grantKitAction(formData("vendor@business.sg", "qkit"));

    expect(res).toEqual({ success: true });
    expect(grantKitMock).toHaveBeenCalledWith("vendor@business.sg", "qkit");
    expect(recordAuditMock).toHaveBeenCalledWith(
      "admin-1",
      "grant_kit_access",
      null,
      { email: "vendor@business.sg", slug: "qkit" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vendors");
  });

  it("rejects invalid input before touching the database", async () => {
    const res = await grantKitAction(formData("not-an-email", "qkit"));

    expect(res).toEqual({
      success: false,
      error: "Enter a valid email and kit.",
    });
    expect(grantKitMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error and skips the audit row on failure", async () => {
    grantKitMock.mockRejectedValue(new Error("boom"));

    const res = await grantKitAction(formData("vendor@business.sg", "qkit"));

    expect(res).toEqual({
      success: false,
      error: "Couldn't grant access. Try again.",
    });
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});

describe("revokeKitAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("revokes access and records an audit row", async () => {
    revokeKitMock.mockResolvedValue(undefined);

    const res = await revokeKitAction(formData("vendor@business.sg", "qkit"));

    expect(res).toEqual({ success: true });
    expect(revokeKitMock).toHaveBeenCalledWith("vendor@business.sg", "qkit");
    expect(recordAuditMock).toHaveBeenCalledWith(
      "admin-1",
      "revoke_kit_access",
      null,
      { email: "vendor@business.sg", slug: "qkit" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vendors");
  });

  it("surfaces a friendly error and skips the audit row on failure", async () => {
    revokeKitMock.mockRejectedValue(new Error("boom"));

    const res = await revokeKitAction(formData("vendor@business.sg", "qkit"));

    expect(res).toEqual({
      success: false,
      error: "Couldn't revoke access. Try again.",
    });
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});
