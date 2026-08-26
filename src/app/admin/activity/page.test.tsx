// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireMerqoTeamMock, listAdminAuditEntriesMock } = vi.hoisted(() => ({
  requireMerqoTeamMock: vi.fn(),
  listAdminAuditEntriesMock: vi.fn(),
}));

vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));

vi.mock("@/lib/admin", () => ({
  listAdminAuditEntries: listAdminAuditEntriesMock,
}));

describe("AdminActivityPage", () => {
  beforeEach(() => {
    requireMerqoTeamMock.mockReset().mockResolvedValue(undefined);
    listAdminAuditEntriesMock.mockReset();
  });

  it("renders rows with a human action label, resolved actor email, and target", async () => {
    listAdminAuditEntriesMock.mockResolvedValue([
      {
        id: "a1",
        admin_id: "u1",
        action: "grant_kit_access",
        target_id: null,
        detail: { email: "vendor@business.sg", slug: "qkit" },
        created_at: "2026-08-01T00:00:00Z",
        adminEmail: "team@merqo.io",
      },
    ]);

    const { default: AdminActivityPage } = await import("./page");
    render(await AdminActivityPage());

    expect(screen.getByText("Granted kit access")).toBeInTheDocument();
    expect(screen.getByText("team@merqo.io")).toBeInTheDocument();
    expect(
      screen.getByText('{"email":"vendor@business.sg","slug":"qkit"}'),
    ).toBeInTheDocument();
  });

  it("falls back to the raw action string for an unmapped action", async () => {
    listAdminAuditEntriesMock.mockResolvedValue([
      {
        id: "a2",
        admin_id: "u1",
        action: "some_future_action",
        target_id: "t1",
        detail: null,
        created_at: "2026-08-01T00:00:00Z",
        adminEmail: "team@merqo.io",
      },
    ]);

    const { default: AdminActivityPage } = await import("./page");
    render(await AdminActivityPage());

    expect(screen.getByText("some_future_action")).toBeInTheDocument();
    expect(screen.getByText("t1")).toBeInTheDocument();
  });

  it("shows the empty state when there is no activity yet", async () => {
    listAdminAuditEntriesMock.mockResolvedValue([]);

    const { default: AdminActivityPage } = await import("./page");
    render(await AdminActivityPage());

    expect(screen.getByText("No admin activity yet.")).toBeInTheDocument();
  });

  it("gates on team membership before reading audit rows", async () => {
    requireMerqoTeamMock.mockRejectedValue(new Error("redirect"));

    const { default: AdminActivityPage } = await import("./page");
    await expect(AdminActivityPage()).rejects.toThrow();
    expect(listAdminAuditEntriesMock).not.toHaveBeenCalled();
  });
});
