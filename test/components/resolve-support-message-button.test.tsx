// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/admin/actions", () => ({
  resolveSupportMessageAction: vi.fn(),
}));

import { resolveSupportMessageAction } from "@/app/admin/actions";
import { ResolveSupportMessageButton } from "@/app/admin/resolve-support-message-button";

describe("ResolveSupportMessageButton", () => {
  it("calls the action with the message id when clicked", async () => {
    vi.mocked(resolveSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<ResolveSupportMessageButton id="m1" />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(resolveSupportMessageAction).toHaveBeenCalledWith("m1"),
    );
  });
});

it("recovers after a rejected action and permits retry", async () => {
  vi.mocked(resolveSupportMessageAction).mockRejectedValueOnce(
    new Error("offline"),
  );
  render(<ResolveSupportMessageButton id="m1" />);
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Resolve" })).toBeEnabled(),
  );
  vi.mocked(resolveSupportMessageAction).mockClear();
  vi.mocked(resolveSupportMessageAction).mockResolvedValue({ success: true });
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
  await waitFor(() =>
    expect(resolveSupportMessageAction).toHaveBeenCalledTimes(1),
  );
});
