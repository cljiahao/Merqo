import { describe, expect, it, vi } from "vitest";
import { adminEmailsById, readAdminRows } from "@/lib/admin-read";
describe("bounded admin readers", () => {
  it("handles a lower configured row cap without dropping remaining pages", async () => {
    const rows = [1, 2, 3, 4, 5];
    const page = vi.fn(async (from: number) => ({
      data: rows.slice(from, from + 2),
      error: null,
    }));
    expect(await readAdminRows("read", page)).toEqual(rows);
    expect(page).toHaveBeenCalledWith(4, 1003);
  });
  it("rejects missing data rather than treating it as an empty page", async () => {
    await expect(
      readAdminRows("read", async () => ({ data: null, error: null })),
    ).rejects.toThrow("Missing query results");
  });
  it("deduplicates IDs and bounds concurrent lookups to eight", async () => {
    const releases: (() => void)[] = [];
    let active = 0;
    let maximum = 0;
    const getUserById = vi.fn((id: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      return new Promise((resolve) =>
        releases.push(() => {
          active -= 1;
          resolve({
            data: { user: { email: id + "@example.com" } },
            error: null,
          });
        }),
      );
    });
    const ids = Array.from({ length: 9 }, (_, index) => String(index));
    const result = adminEmailsById(
      { auth: { admin: { getUserById } } } as never,
      [...ids, "0"],
    );
    expect(getUserById).toHaveBeenCalledTimes(8);
    releases
      .splice(0)
      .reverse()
      .forEach((release) => release());
    await vi.waitFor(() => expect(getUserById).toHaveBeenCalledTimes(9));
    releases.splice(0).forEach((release) => release());
    expect([...(await result)]).toEqual(
      ids.map((id) => [id, id + "@example.com"]),
    );
    expect(maximum).toBe(8);
    expect(active).toBe(0);
  });
  it("retains null email for accounts without an email address", async () => {
    const getUserById = vi
      .fn()
      .mockResolvedValue({ data: { user: {} }, error: null });
    expect(
      (
        await adminEmailsById({ auth: { admin: { getUserById } } } as never, [
          "user",
        ])
      ).get("user"),
    ).toBeNull();
  });
});
