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

describe("grantKit", () => {
  it("succeeds via upsert when the vendor already holds this grant (duplicate grant)", async () => {
    // upsert's onConflict makes this idempotent — granting an already-active
    // link must not throw or create a second row.
    upsertMock.mockResolvedValue({ error: null });

    const { grantKit } = await import("@/lib/admin");
    await expect(
      grantKit("Vendor@Example.com", "qkit"),
    ).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledWith(
      { email: "vendor@example.com", product_slug: "qkit", status: "active" },
      { onConflict: "email,product_slug" },
    );
  });

  it("throws a wrapped error when the upsert fails", async () => {
    upsertMock.mockResolvedValue({
      error: { message: "constraint violation" },
    });

    const { grantKit } = await import("@/lib/admin");
    await expect(grantKit("vendor@example.com", "qkit")).rejects.toThrow(
      /grant: constraint violation/,
    );
  });
});

describe("revokeKit", () => {
  function fakeDeleteClient(result: { error: { message: string } | null }) {
    const eq2 = vi.fn().mockResolvedValue(result);
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const deleteFn = vi.fn(() => ({ eq: eq1 }));
    return {
      client: { from: () => ({ delete: deleteFn }) },
      deleteFn,
      eq1,
      eq2,
    };
  }

  it("resolves cleanly when the grant doesn't exist (delete matches zero rows)", async () => {
    // Postgres/PostgREST report success with no error for a delete that
    // matches nothing — revoking a non-existent grant is not an error case.
    const { client, eq1, eq2 } = fakeDeleteClient({ error: null });
    createServiceClientMock.mockResolvedValue(client);

    const { revokeKit } = await import("@/lib/admin");
    await expect(
      revokeKit("nobody@example.com", "qkit"),
    ).resolves.toBeUndefined();

    expect(eq1).toHaveBeenCalledWith("email", "nobody@example.com");
    expect(eq2).toHaveBeenCalledWith("product_slug", "qkit");
  });

  it("throws a wrapped error when the delete fails", async () => {
    const { client } = fakeDeleteClient({
      error: { message: "permission denied" },
    });
    createServiceClientMock.mockResolvedValue(client);

    const { revokeKit } = await import("@/lib/admin");
    await expect(revokeKit("vendor@example.com", "qkit")).rejects.toThrow(
      /revoke: permission denied/,
    );
  });
});

describe("removeTeamMember", () => {
  function fakeDeleteClient(result: { error: { message: string } | null }) {
    const eqMock = vi.fn().mockResolvedValue(result);
    const deleteFn = vi.fn(() => ({ eq: eqMock }));
    return { client: { from: () => ({ delete: deleteFn }) }, deleteFn, eqMock };
  }

  it("succeeds for an existing member", async () => {
    const { client, eqMock } = fakeDeleteClient({ error: null });
    createServiceClientMock.mockResolvedValue(client);

    const { removeTeamMember } = await import("@/lib/admin");
    await expect(removeTeamMember("u1")).resolves.toBeUndefined();

    expect(eqMock).toHaveBeenCalledWith("user_id", "u1");
  });

  it("resolves cleanly for a user id with no matching membership row (not-found)", async () => {
    // Same as the success case from the DB's point of view — a delete that
    // matches zero rows is not an error — but exercised with an id that was
    // never a member, to cover the caller's not-found path explicitly.
    const { client } = fakeDeleteClient({ error: null });
    createServiceClientMock.mockResolvedValue(client);

    const { removeTeamMember } = await import("@/lib/admin");
    await expect(removeTeamMember("never-a-member")).resolves.toBeUndefined();
  });

  it("throws a wrapped error when the delete fails", async () => {
    const { client } = fakeDeleteClient({
      error: { message: "service unavailable" },
    });
    createServiceClientMock.mockResolvedValue(client);

    const { removeTeamMember } = await import("@/lib/admin");
    await expect(removeTeamMember("u1")).rejects.toThrow(
      /remove team: service unavailable/,
    );
  });
});
