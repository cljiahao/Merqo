// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/join-waitlist", () => ({
  joinWaitlistAction: vi.fn(),
}));

import { joinWaitlistAction } from "@/app/actions/join-waitlist";
import { JoinWaitlistButton } from "@/components/dashboard/join-waitlist-button";

describe("JoinWaitlistButton", () => {
  it("calls the action with the kit's slug when clicked", async () => {
    vi.mocked(joinWaitlistAction).mockResolvedValue({ success: true });
    render(<JoinWaitlistButton slug="loopkit" kitName="loopkit" />);
    fireEvent.click(screen.getByRole("button", { name: "Join waitlist" }));
    await waitFor(() =>
      expect(joinWaitlistAction).toHaveBeenCalledWith("loopkit"),
    );
  });
});
