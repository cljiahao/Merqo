import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fromMock,
  createServiceClientMock,
  requireMerqoTeamMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  requireMerqoTeamMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  resolveSupportMessageAction,
  setBundleDiscountEnabledAction,
} from "./actions";

describe("setBundleDiscountEnabledAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("writes the flag for a team member", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    fromMock.mockReturnValue({ update: updateMock });
    createServiceClientMock.mockResolvedValue({ from: fromMock });

    const res = await setBundleDiscountEnabledAction(true);

    expect(res).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith("billing_settings");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ bundle_discount_enabled: true }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", 1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });

  it("surfaces a friendly error on a DB failure", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: new Error("boom") });
    fromMock.mockReturnValue({ update: () => ({ eq: eqMock }) });
    createServiceClientMock.mockResolvedValue({ from: fromMock });

    const res = await setBundleDiscountEnabledAction(false);

    expect(res).toEqual({ success: false, error: "Could not update setting" });
  });

  it("gates on team membership before touching the database", async () => {
    requireMerqoTeamMock.mockRejectedValue(new Error("redirect"));
    await expect(setBundleDiscountEnabledAction(true)).rejects.toThrow();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("resolveSupportMessageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMerqoTeamMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("resolves a message for a team member", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ update: () => ({ eq: eqMock }) });
    createServiceClientMock.mockResolvedValue({ from: fromMock });

    const res = await resolveSupportMessageAction("msg-1");

    expect(res).toEqual({ success: true });
    expect(eqMock).toHaveBeenCalledWith("id", "msg-1");
  });
});
