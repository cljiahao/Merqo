import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, upsertMock, fromMock, createServerClientMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    upsertMock: vi.fn(),
    fromMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  getUserMock.mockReset();
  upsertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({ upsert: upsertMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe("markTourSeen", () => {
  it("upserts tour_seen_at on the signed-in user's dashboard_prefs row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { markTourSeen } = await import("./tour-actions");
    await markTourSeen();

    expect(fromMock).toHaveBeenCalledWith("dashboard_prefs");
    expect(upsertMock).toHaveBeenCalledWith({
      user_id: "u1",
      tour_seen_at: expect.any(String),
    });
  });

  it("does nothing when no user is signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { markTourSeen } = await import("./tour-actions");
    await markTourSeen();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the upsert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    upsertMock.mockResolvedValue({ error: { message: "RLS denied" } });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { markTourSeen } = await import("./tour-actions");
    await expect(markTourSeen()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "markTourSeen failed",
      "RLS denied",
    );
    consoleError.mockRestore();
  });
});
