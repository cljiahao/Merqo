import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => {
  const eq = () => ({ maybeSingle: mocks.maybeSingle });
  const select = () => ({ eq });
  const from = () => ({ select });
  return {
    createServerClient: async () => ({
      auth: { getUser: mocks.getUser },
      from,
    }),
  };
});
import { requireMerqoTeam } from "@/lib/team";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "operator" } } });
  mocks.maybeSingle.mockResolvedValue({
    data: { user_id: "operator" },
    error: null,
  });
});
it("returns a signed-in team member", async () => {
  await expect(requireMerqoTeam()).resolves.toEqual({
    user: { id: "operator" },
  });
});
it("redirects a missing session before querying membership", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(requireMerqoTeam()).rejects.toThrow("/login");
  expect(mocks.maybeSingle).not.toHaveBeenCalled();
});
it("treats auth outages as signed out", async () => {
  mocks.getUser.mockRejectedValue(new Error("outage"));
  await expect(requireMerqoTeam()).rejects.toThrow("/login");
});
it("denies a signed-in nonmember", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(requireMerqoTeam()).rejects.toThrow("/no-access");
});
it("surfaces membership configuration errors", async () => {
  mocks.maybeSingle.mockResolvedValue({
    data: null,
    error: { message: "schema unavailable" },
  });
  await expect(requireMerqoTeam()).rejects.toThrow("merqo_team read failed");
});

it("rejects returned auth errors even with stale user data", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "operator" } },
    error: { message: "expired" },
  });
  await expect(requireMerqoTeam()).rejects.toThrow("/login");
  expect(mocks.maybeSingle).not.toHaveBeenCalled();
});
