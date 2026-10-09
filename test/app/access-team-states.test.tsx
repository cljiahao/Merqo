import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  team: vi.fn(),
  members: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/team", () => ({ requireMerqoTeam: mocks.team }));
vi.mock("@/lib/admin", () => ({ listTeamMembers: mocks.members }));
vi.mock("@/app/admin/team/add-team-form", () => ({
  AddTeamForm: () => <span>Add member form</span>,
}));
vi.mock("@/app/admin/team/remove-member", () => ({
  RemoveMember: ({ label }: { label: string }) => (
    <button>Remove {label}</button>
  ),
}));
import NoAccess from "@/app/no-access/page";
import TeamPage from "@/app/admin/team/page";
import { signOutAction } from "@/app/actions/auth";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "self", email: "self@example.com" } },
  });
  mocks.team.mockResolvedValue({ user: { id: "self" } });
  mocks.members.mockResolvedValue([]);
  mocks.signOut.mockResolvedValue({ error: null });
});
it("gives signed-in users their identity and recovery options", async () => {
  const html = renderToStaticMarkup(await NoAccess());
  expect(html).toContain("self@example.com");
  expect(html).toContain("Check again");
  expect(html).toContain("Sign out");
});
it("offers sign-in when the session has disappeared", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  const html = renderToStaticMarkup(await NoAccess());
  expect(html).toContain('href="/login"');
  expect(html).not.toContain("Check again");
});
it("handles an account without email", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "self" } } });
  expect(renderToStaticMarkup(await NoAccess())).toContain(
    "Sign in with a Merqo-team account",
  );
});
it("marks the current team member and offers removal only for peers", async () => {
  mocks.members.mockResolvedValue([
    { user_id: "self", email: "self@example.com" },
    { user_id: "peer", email: "peer@example.com" },
    { user_id: "legacy", email: null },
  ]);
  const html = renderToStaticMarkup(await TeamPage());
  expect(html).toContain("(you)");
  expect(html).toContain("Remove peer@example.com");
  expect(html).toContain("Remove legacy");
  expect(html).not.toContain("Remove self@example.com");
});
it("signs out before returning to login", async () => {
  await expect(signOutAction()).rejects.toThrow("/login");
  expect(mocks.signOut).toHaveBeenCalledOnce();
});
