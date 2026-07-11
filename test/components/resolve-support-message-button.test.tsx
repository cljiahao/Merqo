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
