import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  user: vi.fn(),
  list: vi.fn(),
  predicates: vi.fn(),
  ranges: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: mocks.client }));
import {
  getVendorGrant,
  listProducts,
  listTeamMembers,
  listVendorGrants,
} from "@/lib/admin";
let tables: Record<string, Record<string, unknown>[]>;
let failures: Record<string, number>;
beforeEach(() => {
  vi.clearAllMocks();
  tables = {};
  failures = {};
  mocks.user.mockImplementation(async (id: string) => ({
    data: { user: { email: id + "@example.com" } },
    error: null,
  }));
  mocks.client.mockResolvedValue({
    from: (table: string) => {
      let email: string | undefined;
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          mocks.predicates(table, column, value);
          email = value;
          return query;
        },
        order: (column: string) => {
          mocks.predicates(table, "order", column);
          return query;
        },
        range: async (from: number, to: number) => {
          mocks.ranges(table, from, to);
          if (failures[table] === from)
            return { data: null, error: { message: "Unavailable" } };
          const rows = (tables[table] ?? []).filter(
            (row) => email === undefined || row.email === email,
          );
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
    auth: { admin: { getUserById: mocks.user, listUsers: mocks.list } },
  });
});
describe("admin paginated reads", () => {
  it("groups every grant beyond the API cap without dropping the last vendor", async () => {
    tables.vendor_links = Array.from({ length: 1001 }, (_, index) => ({
      email: "vendor" + index + "@example.com",
      product_slug: "qkit",
      status: "active",
    }));
    tables.products = [{ slug: "qkit", name: "Queue" }];
    const result = await listVendorGrants();
    expect(result).toHaveLength(1001);
    expect(
      result.find((row) => row.email === "vendor1000@example.com")?.kits[0]
        .name,
    ).toBe("Queue");
    expect(mocks.ranges).toHaveBeenCalledWith("vendor_links", 1000, 1999);
    expect(mocks.predicates).toHaveBeenCalledWith(
      "vendor_links",
      "order",
      "product_slug",
    );
  });
  it("retains normalized email filtering on every detail page", async () => {
    tables.vendor_links = [
      { email: "vendor@example.com", product_slug: "qkit", status: "active" },
      { email: "other@example.com", product_slug: "qkit", status: "active" },
    ];
    expect((await getVendorGrant("Vendor@Example.com"))?.email).toBe(
      "vendor@example.com",
    );
    expect(mocks.predicates).toHaveBeenCalledWith(
      "vendor_links",
      "email",
      "vendor@example.com",
    );
  });
  it("fails instead of returning grants from a partial read", async () => {
    tables.vendor_links = [
      { email: "vendor@example.com", product_slug: "qkit", status: "active" },
    ];
    failures.vendor_links = 1;
    await expect(listVendorGrants()).rejects.toThrow("links read: Unavailable");
  });
  it("reads all products in stable created-time and slug order", async () => {
    tables.products = Array.from({ length: 1001 }, (_, index) => ({
      slug: "kit" + index,
      name: "Kit",
    }));
    expect(await listProducts()).toHaveLength(1001);
    expect(mocks.predicates).toHaveBeenCalledWith("products", "order", "slug");
  });
  it("resolves only team IDs and sorts email without traversing unrelated auth accounts", async () => {
    tables.merqo_team = [{ user_id: "z" }, { user_id: "a" }];
    expect(await listTeamMembers()).toEqual([
      { user_id: "a", email: "a@example.com" },
      { user_id: "z", email: "z@example.com" },
    ]);
    expect(mocks.user).toHaveBeenCalledTimes(2);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("reads team memberships beyond the API cap", async () => {
    tables.merqo_team = Array.from({ length: 1001 }, (_, index) => ({
      user_id: "user" + index,
    }));
    expect(await listTeamMembers()).toHaveLength(1001);
    expect(mocks.user).toHaveBeenCalledWith("user1000");
  });
  it("skips auth requests for an empty team", async () => {
    expect(await listTeamMembers()).toEqual([]);
    expect(mocks.user).not.toHaveBeenCalled();
  });
});
