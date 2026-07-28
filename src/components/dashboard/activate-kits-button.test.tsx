// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { activateKitsActionMock, toastSuccessMock, refreshMock } = vi.hoisted(
  () => ({
    activateKitsActionMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    refreshMock: vi.fn(),
  }),
);
vi.mock("@/app/actions/activate-kits", () => ({
  activateKitsAction: activateKitsActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

import { ActivateKitsButton } from "./activate-kits-button";

describe("ActivateKitsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a success toast and refreshes when a kit reaches active", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [
        { ok: true, slug: "qkit", alreadyExisted: false, plan: "free" },
      ],
    });
    render(<ActivateKitsButton slugs={["qkit"]} label="Add qkit" />);
    fireEvent.click(screen.getByText("Add qkit"));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Activated qkit"),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows a finish-setup link instead of a success toast when a kit needs setup", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [
        {
          ok: true,
          slug: "paykit",
          alreadyExisted: false,
          plan: null,
          needsSetup: true,
        },
      ],
    });
    render(<ActivateKitsButton slugs={["paykit"]} label="Add paykit" />);
    fireEvent.click(screen.getByText("Add paykit"));
    await waitFor(() =>
      expect(screen.getByText("Finish payment setup")).toBeInTheDocument(),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("still shows a retry affordance when a kit fails, without refreshing", async () => {
    activateKitsActionMock.mockResolvedValue({
      success: true,
      results: [{ ok: false, slug: "loopkit" }],
    });
    render(<ActivateKitsButton slugs={["loopkit"]} label="Add loopkit" />);
    fireEvent.click(screen.getByText("Add loopkit"));
    await waitFor(() =>
      expect(screen.getByLabelText("Retry loopkit")).toBeInTheDocument(),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
