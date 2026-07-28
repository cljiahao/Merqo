// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/activate-kits", () => ({
  activateKitsAction: vi.fn(),
}));

import { activateKitsAction } from "@/app/actions/activate-kits";
import { ActivateKitsButton } from "@/components/dashboard/activate-kits-button";

describe("ActivateKitsButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables while pending and re-enables after resolving", async () => {
    let resolveAction: (v: unknown) => void = () => {};
    vi.mocked(activateKitsAction).mockReturnValue(
      new Promise((r) => (resolveAction = r as typeof resolveAction)),
    );
    render(
      <ActivateKitsButton
        slugs={["qkit", "loopkit"]}
        label="Activate all my kits"
      />,
    );
    const button = screen.getByRole("button", { name: "Activate all my kits" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    resolveAction({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
        { ok: true, slug: "loopkit", alreadyExisted: false, plan: "free" },
      ],
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("renders a per-kit retry affordance for a kit that failed, not a page-level error", async () => {
    vi.mocked(activateKitsAction).mockResolvedValue({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
        { ok: false, slug: "loopkit" },
      ],
    });
    render(
      <ActivateKitsButton
        slugs={["qkit", "loopkit"]}
        label="Activate all my kits"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Activate all my kits" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry loopkit" }),
      ).toBeInTheDocument(),
    );
    // the succeeded kit must NOT also show a retry affordance
    expect(
      screen.queryByRole("button", { name: "Retry qkit" }),
    ).not.toBeInTheDocument();
  });

  it("clicking a single kit's retry re-invokes the action with only that slug", async () => {
    vi.mocked(activateKitsAction)
      .mockResolvedValueOnce({
        success: true,
        results: [{ ok: false, slug: "loopkit" }],
      })
      .mockResolvedValueOnce({
        success: true,
        results: [
          { ok: true, slug: "loopkit", alreadyExisted: false, plan: "free" },
        ],
      });
    render(<ActivateKitsButton slugs={["loopkit"]} label="Add loopkit" />);
    fireEvent.click(screen.getByRole("button", { name: "Add loopkit" }));
    const retryButton = await screen.findByRole("button", {
      name: "Retry loopkit",
    });
    fireEvent.click(retryButton);
    await waitFor(() =>
      expect(activateKitsAction).toHaveBeenLastCalledWith(["loopkit"]),
    );
  });
});
