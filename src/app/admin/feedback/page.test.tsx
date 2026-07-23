// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireMerqoTeamMock, createServerClientMock } = vi.hoisted(() => ({
  requireMerqoTeamMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/team", () => ({
  requireMerqoTeam: requireMerqoTeamMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

function tableMock(rows: unknown[], error: { message: string } | null = null) {
  return {
    select: () => ({
      order: () => ({
        limit: () => Promise.resolve({ data: error ? null : rows, error }),
      }),
    }),
  };
}

describe("AdminFeedbackPage", () => {
  beforeEach(() => {
    requireMerqoTeamMock.mockReset().mockResolvedValue(undefined);
  });

  it("renders hub NPS, per-kit breakdowns, and vendor comments with a kit badge", async () => {
    const feedbackRows = [
      {
        id: "f1",
        nps: 9,
        message: "Love it",
        created_at: "2026-07-01T00:00:00Z",
      },
    ];
    const vendorRows = [
      {
        id: "v1",
        kit_slug: "loopkit",
        nps: 9,
        message: "Great tool",
        created_at: "2026-07-02T00:00:00Z",
      },
      {
        id: "v2",
        kit_slug: "paykit",
        nps: 3,
        message: null,
        created_at: "2026-07-03T00:00:00Z",
      },
    ];
    createServerClientMock.mockResolvedValue({
      from: (table: string) =>
        table === "feedback" ? tableMock(feedbackRows) : tableMock(vendorRows),
    });

    const { default: AdminFeedbackPage } = await import("./page");
    render(await AdminFeedbackPage());

    expect(screen.getAllByText("loopkit").length).toBeGreaterThan(0);
    expect(screen.getByText("paykit")).toBeInTheDocument();
    expect(screen.getByText("Great tool")).toBeInTheDocument();
    expect(screen.getByText("Love it")).toBeInTheDocument();
    expect(
      screen.queryByText("No vendor feedback yet."),
    ).not.toBeInTheDocument();
  });

  it("shows empty states when there is no feedback at all", async () => {
    createServerClientMock.mockResolvedValue({
      from: () => tableMock([]),
    });

    const { default: AdminFeedbackPage } = await import("./page");
    render(await AdminFeedbackPage());

    expect(screen.getByText("No feedback yet.")).toBeInTheDocument();
    expect(screen.getByText("No vendor feedback yet.")).toBeInTheDocument();
  });

  it("throws when the hub feedback query errors", async () => {
    createServerClientMock.mockResolvedValue({
      from: (table: string) =>
        table === "feedback"
          ? tableMock([], { message: "boom" })
          : tableMock([]),
    });

    const { default: AdminFeedbackPage } = await import("./page");
    await expect(AdminFeedbackPage()).rejects.toThrow(
      "feedback read failed: boom",
    );
  });

  it("throws when the vendor_feedback query errors", async () => {
    createServerClientMock.mockResolvedValue({
      from: (table: string) =>
        table === "vendor_feedback"
          ? tableMock([], { message: "boom" })
          : tableMock([]),
    });

    const { default: AdminFeedbackPage } = await import("./page");
    await expect(AdminFeedbackPage()).rejects.toThrow(
      "vendor_feedback read failed: boom",
    );
  });
});
