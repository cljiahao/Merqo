// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: vi.fn(),
}));

import { submitSupportMessageAction } from "@/app/actions/support";
import { SupportForm } from "@/components/support-form";

describe("SupportForm", () => {
  it("shows an error and does not submit when the body is empty", () => {
    render(<SupportForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(submitSupportMessageAction).not.toHaveBeenCalled();
  });

  it("submits the selected category and typed body", async () => {
    vi.mocked(submitSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<SupportForm />);
    fireEvent.click(screen.getByRole("radio", { name: "Billing" }));
    fireEvent.change(screen.getByLabelText("Describe the problem"), {
      target: { value: "Can't access qkit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(submitSupportMessageAction).toHaveBeenCalledWith({
        category: "billing",
        body: "Can't access qkit",
      }),
    );
  });

  it("shows the sent confirmation after a successful submit", async () => {
    vi.mocked(submitSupportMessageAction).mockResolvedValue({
      success: true,
    });
    render(<SupportForm />);
    fireEvent.change(screen.getByLabelText("Describe the problem"), {
      target: { value: "Help" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(
        screen.getByText(/we'll look into this and follow up/i),
      ).toBeInTheDocument(),
    );
  });
});
