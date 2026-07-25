import { describe, it, expect, vi, beforeEach } from "vitest";

const { selectMock, listUsersMock, upsertMock, createServiceClientMock } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    listUsersMock: vi.fn(),
    upsertMock: vi.fn(),
    createServiceClientMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

function fakeSupabase() {
  return {
    from: () => ({
      select: selectMock,
      upsert: upsertMock,
    }),
    auth: { admin: { listUsers: listUsersMock } },
  };
}

beforeEach(() => {
  selectMock.mockReset();
  listUsersMock.mockReset();
  upsertMock.mockReset();
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
});

describe("listTeamMembers", () => {
  it("paginates past a single page of auth users to resolve every email", async () => {
    selectMock.mockResolvedValue({
      data: [{ user_id: "u1" }, { user_id: "u2" }],
      error: null,
    });
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `filler-${i}`,
      email: `filler-${i}@example.com`,
    }));
    listUsersMock
      .mockResolvedValueOnce({ data: { users: page1 }, error: null })
      .mockResolvedValueOnce({
        data: {
          users: [
            { id: "u1", email: "a@example.com" },
            { id: "u2", email: "b@example.com" },
          ],
        },
        error: null,
      });

    const { listTeamMembers } = await import("@/lib/admin");
    const result = await listTeamMembers();

    expect(listUsersMock).toHaveBeenCalledTimes(2);
    expect(listUsersMock).toHaveBeenNthCalledWith(1, {
      page: 1,
      perPage: 1000,
    });
    expect(listUsersMock).toHaveBeenNthCalledWith(2, {
      page: 2,
      perPage: 1000,
    });
    expect(result).toEqual([
      { user_id: "u1", email: "a@example.com" },
      { user_id: "u2", email: "b@example.com" },
    ]);
  });

  it("throws a wrapped error when the auth user list read fails", async () => {
    selectMock.mockResolvedValue({ data: [{ user_id: "u1" }], error: null });
    listUsersMock.mockResolvedValue({
      data: null,
      error: { message: "service unavailable" },
    });

    const { listTeamMembers } = await import("@/lib/admin");
    await expect(listTeamMembers()).rejects.toThrow(
      /list users: service unavailable/,
    );
  });
});

describe("addTeamMemberByEmail", () => {
  it("finds a matching account past the first page and adds it", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `filler-${i}`,
      email: `filler-${i}@example.com`,
    }));
    listUsersMock
      .mockResolvedValueOnce({ data: { users: page1 }, error: null })
      .mockResolvedValueOnce({
        data: { users: [{ id: "u1", email: "Late@Example.com" }] },
        error: null,
      });
    upsertMock.mockResolvedValue({ error: null });

    const { addTeamMemberByEmail } = await import("@/lib/admin");
    const result = await addTeamMemberByEmail("late@example.com");

    expect(listUsersMock).toHaveBeenCalledTimes(2);
    expect(result).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: "u1" },
      { onConflict: "user_id" },
    );
  });

  it("returns false when no account matches the email", async () => {
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });

    const { addTeamMemberByEmail } = await import("@/lib/admin");
    const result = await addTeamMemberByEmail("nobody@example.com");

    expect(result).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
