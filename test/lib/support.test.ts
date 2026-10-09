import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  user: vi.fn(),
  range: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: mocks.client }));
import { listOpenSupportMessages } from "@/lib/support";
let rows: {
  id: string;
  user_id: string;
  kit_slug: string | null;
  category: string;
  body: string;
  created_at: string;
}[];
beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  mocks.range.mockImplementation(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1),
    error: null,
  }));
  mocks.user.mockImplementation(async (id: string) => ({
    data: { user: { email: id + "@example.com" } },
    error: null,
  }));
  const chain = {
    select: () => chain,
    eq: mocks.eq,
    order: mocks.order,
    range: mocks.range,
  };
  mocks.eq.mockReturnValue(chain);
  mocks.order.mockReturnValue(chain);
  mocks.client.mockResolvedValue({
    from: () => chain,
    auth: { admin: { getUserById: mocks.user } },
  });
});
describe("open support messages", () => {
  it("retains kit/category/body and resolves users beyond the former directory cap", async () => {
    rows = [
      {
        id: "m1",
        user_id: "late-user",
        kit_slug: "paykit",
        category: "payment",
        body: "QR failed",
        created_at: "2026-01-01",
      },
      {
        id: "m2",
        user_id: "other",
        kit_slug: null,
        category: "billing",
        body: "Help",
        created_at: "2026-01-02",
      },
    ];
    const result = await listOpenSupportMessages();
    expect(result[0]).toEqual({
      id: "m1",
      email: "late-user@example.com",
      kit_slug: "paykit",
      category: "payment",
      body: "QR failed",
      created_at: "2026-01-01",
    });
    expect(result[1].kit_slug).toBeNull();
    expect(mocks.eq).toHaveBeenCalledWith("status", "open");
    expect(mocks.order).toHaveBeenCalledWith("id");
  });
  it("reads all message pages while resolving a repeated sender only once", async () => {
    rows = Array.from({ length: 1001 }, (_, index) => ({
      id: String(index),
      user_id: "sender",
      kit_slug: "qkit",
      category: "help",
      body: "Help",
      created_at: "2026-01-01",
    }));
    expect(await listOpenSupportMessages()).toHaveLength(1001);
    expect(mocks.range).toHaveBeenCalledWith(1000, 1999);
    expect(mocks.user).toHaveBeenCalledOnce();
  });
  it("uses null for a deleted sender", async () => {
    rows = [
      {
        id: "m1",
        user_id: "missing",
        kit_slug: "qkit",
        category: "help",
        body: "Help",
        created_at: "2026-01-01",
      },
    ];
    mocks.user.mockResolvedValue({
      data: null,
      error: { status: 404, message: "Missing user" },
    });
    expect((await listOpenSupportMessages())[0].email).toBeNull();
  });
  it("does not return partial messages after a later page fails", async () => {
    mocks.range
      .mockResolvedValueOnce({
        data: [{ id: "m1", user_id: "u1" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "connection reset" },
      });
    await expect(listOpenSupportMessages()).rejects.toThrow(
      "support messages read: connection reset",
    );
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("does not conceal an auth-directory outage as missing sender emails", async () => {
    rows = [
      {
        id: "m1",
        user_id: "sender",
        kit_slug: "qkit",
        category: "help",
        body: "Help",
        created_at: "2026-01-01",
      },
    ];
    mocks.user.mockResolvedValue({
      data: null,
      error: { status: 503, message: "Unavailable" },
    });
    await expect(listOpenSupportMessages()).rejects.toThrow(
      "read user: Unavailable",
    );
  });
});
