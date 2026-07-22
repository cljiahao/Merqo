import { describe, it, expect, vi, beforeEach } from "vitest";

const { orderMock, listUsersMock, createServiceClientMock } = vi.hoisted(
  () => ({
    orderMock: vi.fn(),
    listUsersMock: vi.fn(),
    createServiceClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

function fakeSupabase() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ order: orderMock }),
      }),
    }),
    auth: { admin: { listUsers: listUsersMock } },
  };
}

beforeEach(() => {
  orderMock.mockReset();
  listUsersMock.mockReset();
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
});

describe("listOpenSupportMessages", () => {
  it("maps kit_slug and category through, resolving email by user id", async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: "m1",
          user_id: "u1",
          kit_slug: "paykit",
          category: "payment",
          body: "QR won't generate",
          created_at: "2026-07-23T00:00:00.000Z",
        },
        {
          id: "m2",
          user_id: "u2",
          kit_slug: null,
          category: "billing",
          body: "Can't see invoice",
          created_at: "2026-07-23T00:01:00.000Z",
        },
      ],
      error: null,
    });
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "vendor1@example.com" },
          { id: "u2", email: "vendor2@example.com" },
        ],
      },
    });

    const { listOpenSupportMessages } = await import("@/lib/support");
    const result = await listOpenSupportMessages();

    expect(result).toEqual([
      {
        id: "m1",
        email: "vendor1@example.com",
        kit_slug: "paykit",
        category: "payment",
        body: "QR won't generate",
        created_at: "2026-07-23T00:00:00.000Z",
      },
      {
        id: "m2",
        email: "vendor2@example.com",
        kit_slug: null,
        category: "billing",
        body: "Can't see invoice",
        created_at: "2026-07-23T00:01:00.000Z",
      },
    ]);
  });

  it("resolves a message from an unknown user to a null email", async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: "m1",
          user_id: "missing",
          kit_slug: "qkit",
          category: "pass",
          body: "Help",
          created_at: "2026-07-23T00:00:00.000Z",
        },
      ],
      error: null,
    });
    listUsersMock.mockResolvedValue({ data: { users: [] } });

    const { listOpenSupportMessages } = await import("@/lib/support");
    const result = await listOpenSupportMessages();
    expect(result[0].email).toBeNull();
  });

  it("throws a wrapped error when the message read fails", async () => {
    orderMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    listUsersMock.mockResolvedValue({ data: { users: [] } });

    const { listOpenSupportMessages } = await import("@/lib/support");
    await expect(listOpenSupportMessages()).rejects.toThrow(
      /support messages read: connection reset/,
    );
  });
});
