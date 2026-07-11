// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/feedback", () => ({
  submitFeedbackAction: vi.fn(),
}));

import { submitFeedbackAction } from "@/app/actions/feedback";
import { FeedbackForm } from "@/components/feedback-form";

describe("FeedbackForm", () => {
  it("shows an error and does not submit when no score is picked", () => {
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(submitFeedbackAction).not.toHaveBeenCalled();
  });

  it("submits the picked score and no message when none was typed", async () => {
    vi.mocked(submitFeedbackAction).mockResolvedValue({ success: true });
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("radio", { name: "8" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() =>
      expect(submitFeedbackAction).toHaveBeenCalledWith({
        nps: 8,
        message: undefined,
      }),
    );
  });

  it("shows the thank-you message after a successful submit", async () => {
    vi.mocked(submitFeedbackAction).mockResolvedValue({ success: true });
    render(<FeedbackForm />);
    fireEvent.click(screen.getByRole("radio", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() =>
      expect(screen.getByText(/it helps us improve/i)).toBeInTheDocument(),
    );
  });
});
